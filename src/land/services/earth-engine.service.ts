import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import type { PolygonGeometry } from './geojson.service';
import { SatelliteDataset, SatelliteProvider } from '../enums/satellite.enum';

export interface NormalizedSatelliteResult {
  provider: SatelliteProvider;
  dataset: SatelliteDataset;
  observationTime: Date;
  retrievedAt: Date;
  cloudPercentage?: number;
  indices: { ndvi?: number };
  metrics: Record<string, unknown>;
  sourceMetadata: Record<string, unknown>;
  queryVersion: number;
}

@Injectable()
export class EarthEngineService {
  private readonly queryVersion = 1;

  constructor(private readonly configService: ConfigService) {}

  async queryLatestObservation(
    geometry: PolygonGeometry,
  ): Promise<NormalizedSatelliteResult> {
    void geometry;
    if (this.configService.get<string>('earthEngine.mockEnabled') === 'true') {
      return this.mockResult();
    }
    const projectId = this.configService.get<string>('earthEngine.projectId');
    const clientEmail = this.configService.get<string>(
      'earthEngine.clientEmail',
    );
    const privateKey = this.configService
      .get<string>('earthEngine.privateKey')
      ?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      throw new ServiceUnavailableException(
        'Earth Engine credentials are not configured',
      );
    }
    try {
      const auth = new GoogleAuth({
        credentials: { client_email: clientEmail, private_key: privateKey },
        scopes: ['https://www.googleapis.com/auth/earthengine'],
      });
      const client = await auth.getClient();
      await client.getAccessToken();
      throw new ServiceUnavailableException(
        'Earth Engine query adapter must be configured for the selected deployment API',
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Earth Engine is temporarily unavailable',
      );
    }
  }

  private mockResult(): NormalizedSatelliteResult {
    const now = new Date();
    return {
      provider: SatelliteProvider.GOOGLE_EARTH_ENGINE,
      dataset: SatelliteDataset.SENTINEL_2,
      observationTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      retrievedAt: now,
      cloudPercentage: 0,
      indices: { ndvi: 0.62 },
      metrics: {},
      sourceMetadata: { mode: 'mock' },
      queryVersion: this.queryVersion,
    };
  }
}
