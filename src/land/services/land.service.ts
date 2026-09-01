import { ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateLandDto } from '../dtos/create-land.dto';
import { SatelliteDataset, SatelliteMapLayer, SatelliteObservationStatus } from '../enums/satellite.enum';
import { Land } from '../schemas/land.schema';
import { SatelliteObservation, SatelliteObservationDocument } from '../schemas/satellite-observation.schema';
import { EarthEngineService, NoSatelliteDataError } from './earth-engine.service';
import { GeojsonService } from './geojson.service';
import type { PointGeometry, PolygonGeometry } from './geojson.service';

@Injectable()
export class LandService {
  private readonly logger = new Logger(LandService.name);

  constructor(@InjectModel(Land.name) private readonly landModel: Model<Land>, @InjectModel(SatelliteObservation.name) private readonly observationModel: Model<SatelliteObservation>, private readonly geojsonService: GeojsonService, private readonly earthEngineService: EarthEngineService, private readonly configService: ConfigService) {}

  async getCurrent(userId: string) {
    const land = await this.landModel.findOne({ userId }).lean();

    if (!land) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'LAND_NOT_FOUND',
        message: 'No land is registered for this user.',
      });
    }

    const latest = await this.latestObservation(land._id);

    return this.response(land, latest);
  }

  async create(userId: string, dto: CreateLandDto) {
    const validated = this.geojsonService.validatePolygon(dto.geometry);
    const existing = await this.landModel.findOne({ userId }).lean();

    if (existing) {
      throw new ConflictException('User already has a land record');
    }

    const now = new Date();

    const land = await this.landModel.create({userId,...validated,lastSatelliteAttemptAt: now, nextSatelliteRefreshAt: now,  });

    let observation: SatelliteObservationDocument | null = null;

    try {
      this.logger.log(`Requesting initial satellite observation for land ${land._id.toString()}`);

      const result = await this.earthEngineService.queryLatestObservation(validated.geometry);

      observation = await this.observationModel.create({landId: land._id,userId,...result,status: SatelliteObservationStatus.SUCCESS,});

      land.lastSatelliteAttemptAt = result.retrievedAt;
      land.lastSatelliteQueryAt = result.retrievedAt;
      land.lastSatelliteStatus = SatelliteObservationStatus.SUCCESS;
      land.nextSatelliteRefreshAt = this.nextRefresh(result.retrievedAt);

      await land.save();

      this.logger.log(`Satellite observation stored for land ${land._id.toString()} as observation ${observation._id.toString()}`);
    } catch (error) {
      const attemptedAt = new Date();

      land.lastSatelliteAttemptAt = attemptedAt;
      land.nextSatelliteRefreshAt = this.nextFailureRetry(attemptedAt);

      if (error instanceof NoSatelliteDataError) {
        land.lastSatelliteStatus = SatelliteObservationStatus.NO_DATA;
        this.logger.warn(`No satellite data stored for land ${land._id.toString()}: ${error.message}`);
      } else {
        land.lastSatelliteStatus = SatelliteObservationStatus.TEMPORARILY_UNAVAILABLE;
        this.logger.error(`Initial satellite query failed for land ${land._id.toString()}: ${this.errorMessage(error)}`);
      }

      await land.save();
    }

    return this.response(land.toObject(), observation?.toObject() ?? null);
  }

  async deleteCurrent(userId: string) {
    const land = await this.landModel.findOneAndDelete({ userId });

    if (!land) {
      throw new NotFoundException('Land not found');
    }

    await this.observationModel.deleteMany({ landId: land._id, userId });

    return { deleted: true };
  }

  async history(userId: string, limit = 30) {
    const land = await this.landModel.findOne({ userId }).lean();

    if (!land) {
      throw new NotFoundException('Land not found');
    }

    return this.observationModel.find({ landId: land._id, userId }).sort({ observationTime: -1 }).limit(limit).lean();
  }

  async refresh(userId: string) {
    const land = await this.landModel.findOne({ userId });

    if (!land) {
      throw new NotFoundException('Land not found');
    }

    this.assertRefreshAllowed(land.lastSatelliteQueryAt, land.nextSatelliteRefreshAt);

    const now = new Date();

    const claimed = await this.landModel.findOneAndUpdate({ _id: land._id, nextSatelliteRefreshAt: { $lte: now } }, { $set: { lastSatelliteAttemptAt: now, nextSatelliteRefreshAt: this.nextRefresh(now) } }, { returnDocument: 'after' });

    if (!claimed) {
      throw new ConflictException({
        code: 'SATELLITE_REFRESH_IN_PROGRESS',
      });
    }

    try {
      this.logger.log(`Refreshing satellite observation for land ${claimed._id.toString()}`);

      const result = await this.earthEngineService.queryLatestObservation(claimed.geometry);

      const observation = await this.observationModel.create({
        landId: claimed._id,
        userId,
        ...result,
        status: SatelliteObservationStatus.SUCCESS,
      });

      claimed.lastSatelliteAttemptAt = result.retrievedAt;
      claimed.lastSatelliteQueryAt = result.retrievedAt;
      claimed.lastSatelliteStatus = SatelliteObservationStatus.SUCCESS;
      claimed.nextSatelliteRefreshAt = this.nextRefresh(result.retrievedAt);

      await claimed.save();

      this.logger.log(`Satellite refresh stored for land ${claimed._id.toString()} as observation ${observation._id.toString()}`);

      return this.response(claimed.toObject(), observation.toObject());
    } catch (error) {
      const attemptedAt = new Date();

      claimed.lastSatelliteAttemptAt = attemptedAt;
      claimed.nextSatelliteRefreshAt = this.nextFailureRetry(attemptedAt);

      if (error instanceof NoSatelliteDataError) {
        claimed.lastSatelliteStatus = SatelliteObservationStatus.NO_DATA;

        await claimed.save();

        this.logger.warn(`Satellite refresh produced no usable observation for land ${claimed._id.toString()}: ${error.message}`);

        const latest = await this.latestObservation(claimed._id);

        return this.response(claimed.toObject(), latest);
      }

      claimed.lastSatelliteStatus = SatelliteObservationStatus.TEMPORARILY_UNAVAILABLE;

      await claimed.save();

      this.logger.error(`Satellite refresh failed for land ${claimed._id.toString()}: ${this.errorMessage(error)}`);

      throw error;
    }
  }

  async getMapTile(userId: string, layer: SatelliteMapLayer, z: number, x: number, y: number): Promise<string> {
    const land = await this.landModel.findOne({ userId }).lean();

    if (!land) {
      throw new NotFoundException('Land not found');
    }

    const observation = await this.latestObservation(land._id);

    if (!observation) {
      throw new NotFoundException({
        code: 'SATELLITE_OBSERVATION_NOT_FOUND',
        message: 'No successful satellite observation is available for this land.',
      });
    }

    const imageId = this.extractImageId(observation.sourceMetadata);

    if (!imageId) {
      throw new NotFoundException({
        code: 'SATELLITE_IMAGE_NOT_FOUND',
        message: 'The latest satellite observation does not contain a source image identifier.',
      });
    }

    return this.earthEngineService.getMapTileUrl(land._id.toString(), land.geometry, imageId, layer, x, y, z);
  }

  async getMapLayers(userId: string) {
    const land = await this.landModel.findOne({ userId }).lean();

    if (!land) {
      throw new NotFoundException('Land not found');
    }

    const observation = await this.latestObservation(land._id);

    if (!observation) {
      throw new NotFoundException({
        code: 'SATELLITE_OBSERVATION_NOT_FOUND',
        message: 'No successful satellite observation is available for this land.',
      });
    }

    return {
      observationTime: observation.observationTime,
      layers: [
        {
          id: SatelliteMapLayer.NDVI_HEATMAP,
          name: 'Vegetation Health',
          description: 'NDVI vegetation health heat map.',
          tilePath: `/api/land/current/maps/${SatelliteMapLayer.NDVI_HEATMAP}/tiles/{z}/{x}/{y}`,
        },
        {
          id: SatelliteMapLayer.NDMI_HEATMAP,
          name: 'Vegetation Moisture',
          description: 'NDMI vegetation moisture heat map.',
          tilePath: `/api/land/current/maps/${SatelliteMapLayer.NDMI_HEATMAP}/tiles/{z}/{x}/{y}`,
        },
      ],
    };
  }

  private assertRefreshAllowed(last: Date | undefined, next: Date) {
    const now = new Date();

    if (next && now < next) {
      throw new HttpException({
        code: 'SATELLITE_REFRESH_NOT_READY',
        lastQueriedAt: last,
        nextRefreshAt: next,
        retryAfterSeconds: Math.ceil((next.getTime() - now.getTime()) / 1000),
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private latestObservation(landId: Types.ObjectId) {
    return this.observationModel.findOne({ landId, status: SatelliteObservationStatus.SUCCESS }).sort({ retrievedAt: -1 }).lean();
  }

  private nextRefresh(from: Date) {
    return new Date(from.getTime() + (this.configService.get<number>('earthEngine.refreshIntervalSeconds') ?? 900) * 1000);
  }

  private nextFailureRetry(from: Date) {
    return new Date(from.getTime() + (this.configService.get<number>('earthEngine.failureRetrySeconds') ?? 60) * 1000);
  }

  private response(land: LandView, observation: ObservationView | null) {
    return {
      land: this.landDto(land),
      satellite: observation ? this.satelliteDto(observation) : null,
      satelliteStatus: land.lastSatelliteStatus ?? null,
      refresh: {
        lastQueriedAt: land.lastSatelliteQueryAt ?? null,
        lastAttemptedAt: land.lastSatelliteAttemptAt ?? null,
        nextRefreshAt: land.nextSatelliteRefreshAt,
        refreshAllowed: !land.nextSatelliteRefreshAt || new Date() >= new Date(land.nextSatelliteRefreshAt),
      },
    };
  }

  private landDto(land: LandView) {
    return {
      id: land._id?.toString(),
      geometry: land.geometry,
      areaSqMeters: land.areaSqMeters,
      centroid: land.centroid,
    };
  }

  private satelliteDto(observation: ObservationView) {
    return {
      observationTime: observation.observationTime,
      retrievedAt: observation.retrievedAt,
      dataset: observation.dataset,
      cloudPercentage: observation.cloudPercentage,
      indices: {
        ndvi: observation.indices?.ndvi,
        ndmi: observation.indices?.ndmi,
        ndwi: observation.indices?.ndwi,
        evi: observation.indices?.evi,
        savi: observation.indices?.savi,
      },
    };
  }

  private extractImageId(sourceMetadata: Record<string, unknown> | undefined): string | null {
    const imageId = sourceMetadata?.imageId;

    return typeof imageId === 'string' && imageId.length > 0 ? imageId : null;
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}

interface LandView {
  _id?: Types.ObjectId | string;
  geometry: PolygonGeometry;
  areaSqMeters: number;
  centroid: PointGeometry;
  lastSatelliteQueryAt?: Date;
  lastSatelliteAttemptAt?: Date;
  lastSatelliteStatus?: SatelliteObservationStatus;
  nextSatelliteRefreshAt: Date;
}

interface ObservationView {
  observationTime: Date;
  retrievedAt: Date;
  dataset: SatelliteDataset;
  cloudPercentage?: number;
  indices?: {
    ndvi?: number;
    ndmi?: number;
    ndwi?: number;
    evi?: number;
    savi?: number;
  };
  sourceMetadata?: Record<string, unknown>;
}