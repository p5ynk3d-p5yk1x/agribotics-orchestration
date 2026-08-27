import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Land } from '../schemas/land.schema';
import {
  SatelliteObservation,
  SatelliteObservationDocument,
} from '../schemas/satellite-observation.schema';
import { SatelliteObservationStatus } from '../enums/satellite.enum';
import { CreateLandDto } from '../dtos/create-land.dto';
import { EarthEngineService } from './earth-engine.service';
import { GeojsonService } from './geojson.service';
import { ConfigService } from '@nestjs/config';
import type { PointGeometry, PolygonGeometry } from './geojson.service';
import type { SatelliteDataset } from '../enums/satellite.enum';

@Injectable()
export class LandService {
  constructor(
    @InjectModel(Land.name) private readonly landModel: Model<Land>,
    @InjectModel(SatelliteObservation.name)
    private readonly observationModel: Model<SatelliteObservation>,
    private readonly geojsonService: GeojsonService,
    private readonly earthEngineService: EarthEngineService,
    private readonly configService: ConfigService,
  ) {}

  async getCurrent(userId: string) {
    const land = await this.landModel.findOne({ userId }).lean();
    if (!land) return { land: null, satellite: null, refresh: null };
    const latest = await this.latestObservation(land._id);
    return this.response(land, latest);
  }

  async create(userId: string, dto: CreateLandDto) {
    const validated = this.geojsonService.validatePolygon(dto.geometry);
    const existing = await this.landModel.findOne({ userId }).lean();
    if (existing) throw new ConflictException('User already has a land record');
    const now = new Date();
    const nextSatelliteRefreshAt = this.nextRefresh(now);
    const land = await this.landModel.create({
      userId,
      ...validated,
      nextSatelliteRefreshAt,
    });
    let observation: SatelliteObservationDocument | null = null;
    let satelliteStatus: string | undefined;
    try {
      const result = await this.earthEngineService.queryLatestObservation(
        validated.geometry,
      );
      observation = await this.observationModel.create({
        landId: land._id,
        userId,
        ...result,
        status: SatelliteObservationStatus.SUCCESS,
      });
      land.lastSatelliteQueryAt = result.retrievedAt;
      land.nextSatelliteRefreshAt = this.nextRefresh(result.retrievedAt);
      await land.save();
    } catch {
      satelliteStatus = SatelliteObservationStatus.TEMPORARILY_UNAVAILABLE;
    }
    return {
      ...this.response(land.toObject(), observation?.toObject() ?? null),
      satelliteStatus,
    };
  }

  async deleteCurrent(userId: string) {
    const land = await this.landModel.findOneAndDelete({ userId });
    if (!land) throw new NotFoundException('Land not found');
    await this.observationModel.deleteMany({ landId: land._id, userId });
    return { deleted: true };
  }

  async history(userId: string, limit = 30) {
    const land = await this.landModel.findOne({ userId }).lean();
    if (!land) throw new NotFoundException('Land not found');
    return this.observationModel
      .find({ landId: land._id, userId })
      .sort({ observationTime: -1 })
      .limit(limit)
      .lean();
  }

  async refresh(userId: string) {
    const land = await this.landModel.findOne({ userId });
    if (!land) throw new NotFoundException('Land not found');
    this.assertRefreshAllowed(
      land.lastSatelliteQueryAt,
      land.nextSatelliteRefreshAt,
    );
    // MongoDB-backed timestamp claim: second check is encoded in the conditional update.
    const claimed = await this.landModel.findOneAndUpdate(
      { _id: land._id, nextSatelliteRefreshAt: { $lte: new Date() } },
      { $set: { nextSatelliteRefreshAt: this.nextRefresh(new Date()) } },
      { new: true },
    );
    if (!claimed)
      throw new ConflictException({ code: 'SATELLITE_REFRESH_IN_PROGRESS' });
    const result = await this.earthEngineService.queryLatestObservation(
      claimed.geometry,
    );
    const observation = await this.observationModel.create({
      landId: claimed._id,
      userId,
      ...result,
      status: SatelliteObservationStatus.SUCCESS,
    });
    claimed.lastSatelliteQueryAt = result.retrievedAt;
    claimed.nextSatelliteRefreshAt = this.nextRefresh(result.retrievedAt);
    await claimed.save();
    return this.response(claimed.toObject(), observation.toObject());
  }

  private assertRefreshAllowed(last: Date | undefined, next: Date) {
    const now = new Date();
    if (next && now < next) {
      throw new HttpException(
        {
          code: 'SATELLITE_REFRESH_NOT_READY',
          lastQueriedAt: last,
          nextRefreshAt: next,
          retryAfterSeconds: Math.ceil((next.getTime() - now.getTime()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private latestObservation(landId: Types.ObjectId) {
    return this.observationModel
      .findOne({ landId })
      .sort({ retrievedAt: -1 })
      .lean();
  }
  private nextRefresh(from: Date) {
    return new Date(
      from.getTime() +
        (this.configService.get<number>('earthEngine.refreshIntervalSeconds') ??
          900) *
          1000,
    );
  }
  private response(land: LandView, observation: ObservationView | null) {
    return {
      land: this.landDto(land),
      satellite: observation ? this.satelliteDto(observation) : null,
      refresh: {
        lastQueriedAt: land.lastSatelliteQueryAt ?? null,
        nextRefreshAt: land.nextSatelliteRefreshAt,
        refreshAllowed:
          !land.nextSatelliteRefreshAt ||
          new Date() >= new Date(land.nextSatelliteRefreshAt),
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
  private satelliteDto(o: ObservationView) {
    return {
      observationTime: o.observationTime,
      retrievedAt: o.retrievedAt,
      dataset: o.dataset,
      ndvi: o.indices?.ndvi,
      cloudPercentage: o.cloudPercentage,
    };
  }
}

interface LandView {
  _id?: Types.ObjectId | string;
  geometry: PolygonGeometry;
  areaSqMeters: number;
  centroid: PointGeometry;
  lastSatelliteQueryAt?: Date;
  nextSatelliteRefreshAt?: Date;
}

interface ObservationView {
  observationTime: Date;
  retrievedAt: Date;
  dataset: SatelliteDataset;
  indices?: { ndvi?: number };
  cloudPercentage?: number;
}
