import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import type { AnyAuthClient } from 'google-auth-library';
import ee = require('@google/earthengine');
import { SatelliteDataset, SatelliteMapLayer, SatelliteProvider } from '../enums/satellite.enum';
import type { PolygonGeometry } from './geojson.service';

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const SENTINEL_2_COLLECTION = 'COPERNICUS/S2_SR_HARMONIZED';

export interface SatelliteIndices {
  ndvi?: number;
  ndmi?: number;
  ndwi?: number;
  evi?: number;
  savi?: number;
}

export interface NormalizedSatelliteResult {
  provider: SatelliteProvider;
  dataset: SatelliteDataset;
  observationTime: Date;
  retrievedAt: Date;
  cloudPercentage?: number;
  indices: SatelliteIndices;
  metrics: Record<string, unknown>;
  sourceMetadata: Record<string, unknown>;
  queryVersion: number;
}

interface EarthEngineEvaluation {
  ndvi: number | null;
  ndmi: number | null;
  ndwi: number | null;
  evi: number | null;
  savi: number | null;
  validPixelCount: number | null;
  totalPixelCount: number | null;
  clearCoveragePercentage: number | null;
  observationTime: number | null;
  cloudPercentage: number | null;
  imageId: string | null;
}

interface EarthEngineMapId {
  mapid: string;
  token?: string;
  [key: string]: unknown;
}

interface CachedMap {
  mapId: EarthEngineMapId;
  expiresAt: number;
}

export class NoSatelliteDataError extends Error {
  constructor(message = 'No usable Sentinel-2 satellite observation was available for this land') {
    super(message);
    this.name = 'NoSatelliteDataError';
  }
}

@Injectable()
export class EarthEngineService {
  private readonly logger = new Logger(EarthEngineService.name);
  private readonly queryVersion = 4;
  private readonly auth: GoogleAuth;
  private readonly mapCache = new Map<string, CachedMap>();
  private readonly mapCreationPromises = new Map<string, Promise<EarthEngineMapId>>();
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private authClient: AnyAuthClient | null = null;
  private tokenExpiresAt = 0;
  private tokenRefreshPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.auth = new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] });
  }

  async queryLatestObservation(geometry: PolygonGeometry): Promise<NormalizedSatelliteResult> {
    if (this.configService.get<boolean>('earthEngine.mockEnabled') === true) {
      this.logger.warn('Earth Engine mock mode is enabled');
      return this.mockResult();
    }

    await this.ensureAuthenticated();

    const maxRetries = this.configService.get<number>('earthEngine.maxRetries') ?? 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeObservationQuery(geometry);
      } catch (error) {
        if (error instanceof NoSatelliteDataError) {
          this.logger.warn(error.message);
          throw error;
        }

        const message = this.errorMessage(error);

        if (!this.isRetryable(error) || attempt === maxRetries) {
          this.logger.error(`Earth Engine query failed after ${attempt + 1} attempt(s): ${message}`);
          throw new ServiceUnavailableException('Earth Engine is temporarily unavailable');
        }

        const delayMs = this.retryDelay(attempt);
        this.logger.warn(`Earth Engine query attempt ${attempt + 1} failed: ${message}. Retrying in ${delayMs}ms`);
        await this.sleep(delayMs);
      }
    }

    throw new ServiceUnavailableException('Earth Engine is temporarily unavailable');
  }

  async getMapTileUrl(cacheOwner: string, geometry: PolygonGeometry, imageId: string, layer: SatelliteMapLayer, x: number, y: number, z: number): Promise<string> {
    await this.ensureAuthenticated();

    const mapId = await this.getOrCreateMapId(cacheOwner, geometry, imageId, layer);

    try {
      return ee.data.getTileUrl(mapId, x, y, z);
    } catch (error) {
      const cacheKey = this.mapCacheKey(cacheOwner, imageId, layer);
      this.mapCache.delete(cacheKey);
      this.logger.warn(`Earth Engine map tile cache invalidated for ${layer}: ${this.errorMessage(error)}`);
      const regeneratedMapId = await this.getOrCreateMapId(cacheOwner, geometry, imageId, layer);
      return ee.data.getTileUrl(regeneratedMapId, x, y, z);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeEarthEngine();

    try {
      await this.initializationPromise;
    } finally {
      if (!this.initialized) {
        this.initializationPromise = null;
      }
    }
  }

  private async initializeEarthEngine(): Promise<void> {
    const projectId = this.configService.get<string>('earthEngine.projectId');

    if (!projectId) {
      throw new ServiceUnavailableException('Earth Engine project ID is not configured');
    }

    try {
      this.authClient = await this.auth.getClient();
      await this.refreshEarthEngineToken(true);

      const requestTimeoutMs = this.configService.get<number>('earthEngine.requestTimeoutMs') ?? 30000;
      ee.data.setDeadline(requestTimeoutMs);

      await new Promise<void>((resolve, reject) => {
        ee.initialize(null, null, resolve, (error: string) => reject(new Error(error)), null, projectId);
      });

      this.initialized = true;
      this.logger.log(`Google Earth Engine initialized for project ${projectId}`);
    } catch (error) {
      const message = this.errorMessage(error);
      this.logger.error(`Google Earth Engine initialization failed: ${message}`);
      throw new ServiceUnavailableException(`Earth Engine authentication or initialization failed: ${message}`);
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    await this.ensureInitialized();

    if (Date.now() >= this.tokenExpiresAt - 5 * 60 * 1000) {
      await this.refreshEarthEngineToken();
    }
  }

  private async refreshEarthEngineToken(force = false): Promise<void> {
    if (!this.authClient) {
      this.authClient = await this.auth.getClient();
    }

    if (!force && Date.now() < this.tokenExpiresAt - 5 * 60 * 1000) {
      return;
    }

    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = (async () => {
      const response = await this.authClient!.getAccessToken();
      const accessToken = this.extractAccessToken(response);

      if (!accessToken) {
        throw new Error('Google ADC did not return an access token');
      }

      const credentialExpiry = this.authClient!.credentials?.expiry_date;
      this.tokenExpiresAt = typeof credentialExpiry === 'number' ? credentialExpiry : Date.now() + 55 * 60 * 1000;

      ee.data.setAuthToken('adc', 'Bearer', accessToken, Math.max(60, Math.floor((this.tokenExpiresAt - Date.now()) / 1000)), [CLOUD_PLATFORM_SCOPE], undefined, false, true);
      this.logger.log('Google Earth Engine access token refreshed');
    })();

    try {
      await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private async executeObservationQuery(geometry: PolygonGeometry): Promise<NormalizedSatelliteResult> {
    const landGeometry = ee.Geometry.Polygon(geometry.coordinates);
    const lookbackDays = this.configService.get<number>('earthEngine.lookbackDays') ?? 30;
    const extendedLookbackDays = this.configService.get<number>('earthEngine.extendedLookbackDays') ?? 90;
    const maxCloudPercentage = this.configService.get<number>('earthEngine.fallbackMaxCloudPercentage') ?? 80;
    const minClearCoveragePercentage = this.configService.get<number>('earthEngine.minClearCoveragePercentage') ?? 60;
    const currentResult = await this.searchObservationWindow(landGeometry, lookbackDays, 0, maxCloudPercentage, minClearCoveragePercentage, 'CURRENT_WINDOW');

    if (currentResult) {
      return currentResult;
    }

    this.logger.warn(`No Sentinel-2 observation met ${minClearCoveragePercentage}% field clear coverage in the last ${lookbackDays} days. Extending search to ${extendedLookbackDays} days`);

    const extendedResult = await this.searchObservationWindow(landGeometry, extendedLookbackDays, lookbackDays, maxCloudPercentage, minClearCoveragePercentage, 'EXTENDED_WINDOW');

    if (extendedResult) {
      return extendedResult;
    }

    const message = `Sentinel-2 scenes exist for the land, but none met ${minClearCoveragePercentage}% clear field coverage in the last ${extendedLookbackDays} days`;
    this.logger.warn(message);
    throw new NoSatelliteDataError(message);
  }

  private async searchObservationWindow(landGeometry: any, lookbackDays: number, endOffsetDays: number, maxCloudPercentage: number, minClearCoveragePercentage: number, selectionMode: string): Promise<NormalizedSatelliteResult | null> {
    const maxCandidateImages = this.configService.get<number>('earthEngine.maxCandidateImages') ?? 6;
    const now = new Date();
    const endDate = new Date(now.getTime() - endOffsetDays * 24 * 60 * 60 * 1000);
    const startDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

    const collection = ee.ImageCollection(SENTINEL_2_COLLECTION)
      .filterBounds(landGeometry)
      .filterDate(startDate.toISOString(), endDate.toISOString())
      .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', maxCloudPercentage))
      .sort('system:time_start', false);

    const count = await this.evaluate<number>(collection.size());
    this.logger.log(`${selectionMode} Sentinel-2 search found ${count} candidate scene(s) between ${startDate.toISOString()} and ${endDate.toISOString()}`);

    if (count <= 0) {
      return null;
    }

    const candidateCount = Math.min(count, maxCandidateImages);
    const candidates = collection.toList(candidateCount);

    for (let index = 0; index < candidateCount; index++) {
      const image = ee.Image(candidates.get(index));
      const evaluated = await this.evaluateImage(image, landGeometry);

      if (!this.hasUsableIndices(evaluated)) {
        this.logger.warn(`${selectionMode} candidate ${index + 1}/${candidateCount} contained no usable index data over the selected land`);
        continue;
      }

      const clearCoveragePercentage = evaluated.clearCoveragePercentage ?? 0;

      if (clearCoveragePercentage < minClearCoveragePercentage) {
        this.logger.log(`${selectionMode} candidate ${index + 1}/${candidateCount} rejected: field clear coverage ${clearCoveragePercentage.toFixed(2)}% is below required ${minClearCoveragePercentage}%`);
        continue;
      }

      const result = this.normalizedResult(evaluated, selectionMode, lookbackDays);
      this.logger.log(`Sentinel-2 observation selected: image=${evaluated.imageId}, observationTime=${result.observationTime.toISOString()}, sceneCloud=${this.formatNumber(evaluated.cloudPercentage)}%, fieldClear=${clearCoveragePercentage.toFixed(2)}%, ndvi=${result.indices.ndvi?.toFixed(4)}, ndmi=${result.indices.ndmi?.toFixed(4)}`);
      return result;
    }

    return null;
  }

  private async evaluateImage(image: any, landGeometry: any): Promise<EarthEngineEvaluation> {
    const scaleMeters = this.configService.get<number>('earthEngine.scaleMeters') ?? 10;
    const clearMask = this.buildClearMask(image);
    const indices = this.buildIndices(image, landGeometry);

    const meanValues = indices.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: landGeometry,
      scale: scaleMeters,
      maxPixels: 10000000,
      bestEffort: false,
    });

    const validPixelCountResult = indices.select('NDVI').reduceRegion({
      reducer: ee.Reducer.count(),
      geometry: landGeometry,
      scale: scaleMeters,
      maxPixels: 10000000,
      bestEffort: false,
    });

    const totalPixelImage = ee.Image.constant(1).updateMask(image.select('SCL').mask()).rename('TOTAL');
    const clearPixelImage = ee.Image.constant(1).updateMask(clearMask).rename('CLEAR');

    const totalPixelCountResult = totalPixelImage.reduceRegion({
      reducer: ee.Reducer.count(),
      geometry: landGeometry,
      scale: scaleMeters,
      maxPixels: 10000000,
      bestEffort: false,
    });

    const clearPixelCountResult = clearPixelImage.reduceRegion({
      reducer: ee.Reducer.count(),
      geometry: landGeometry,
      scale: scaleMeters,
      maxPixels: 10000000,
      bestEffort: false,
    });

    const combined = ee.Dictionary({
      ndvi: meanValues.get('NDVI'),
      ndmi: meanValues.get('NDMI'),
      ndwi: meanValues.get('NDWI'),
      evi: meanValues.get('EVI'),
      savi: meanValues.get('SAVI'),
      validPixelCount: validPixelCountResult.get('NDVI'),
      totalPixelCount: totalPixelCountResult.get('TOTAL'),
      clearPixelCount: clearPixelCountResult.get('CLEAR'),
      observationTime: image.get('system:time_start'),
      cloudPercentage: image.get('CLOUDY_PIXEL_PERCENTAGE'),
      imageId: image.get('system:index'),
    });

    const evaluated = await this.evaluate<Record<string, unknown>>(combined);
    const totalPixelCount = this.numberOrNull(evaluated.totalPixelCount);
    const clearPixelCount = this.numberOrNull(evaluated.clearPixelCount);
    const clearCoveragePercentage = totalPixelCount !== null && totalPixelCount > 0 && clearPixelCount !== null ? clearPixelCount / totalPixelCount * 100 : null;

    return {
      ndvi: this.numberOrNull(evaluated.ndvi),
      ndmi: this.numberOrNull(evaluated.ndmi),
      ndwi: this.numberOrNull(evaluated.ndwi),
      evi: this.numberOrNull(evaluated.evi),
      savi: this.numberOrNull(evaluated.savi),
      validPixelCount: this.numberOrNull(evaluated.validPixelCount),
      totalPixelCount,
      clearCoveragePercentage,
      observationTime: this.numberOrNull(evaluated.observationTime),
      cloudPercentage: this.numberOrNull(evaluated.cloudPercentage),
      imageId: typeof evaluated.imageId === 'string' ? evaluated.imageId : null,
    };
  }

  private buildIndices(image: any, landGeometry: any) {
    const clearMask = this.buildClearMask(image);
    const reflectance = image.updateMask(clearMask).select(['B2', 'B3', 'B4', 'B8', 'B11']).multiply(0.0001);
    const blue = reflectance.select('B2');
    const green = reflectance.select('B3');
    const red = reflectance.select('B4');
    const nir = reflectance.select('B8');
    const swir = reflectance.select('B11');
    const ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
    const ndmi = nir.subtract(swir).divide(nir.add(swir)).rename('NDMI');
    const ndwi = green.subtract(nir).divide(green.add(nir)).rename('NDWI');
    const evi = nir.subtract(red).multiply(2.5).divide(nir.add(red.multiply(6)).subtract(blue.multiply(7.5)).add(1)).rename('EVI');
    const savi = nir.subtract(red).multiply(1.5).divide(nir.add(red).add(0.5)).rename('SAVI');
    return ndvi.addBands(ndmi).addBands(ndwi).addBands(evi).addBands(savi).clip(landGeometry);
  }

  private buildClearMask(image: any) {
    const scl = image.select('SCL');
    return scl.neq(0).and(scl.neq(1)).and(scl.neq(3)).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
  }

  private hasUsableIndices(result: EarthEngineEvaluation): boolean {
    return result.ndvi !== null
      && result.ndmi !== null
      && result.ndwi !== null
      && result.evi !== null
      && result.savi !== null
      && result.observationTime !== null
      && result.validPixelCount !== null
      && result.validPixelCount > 0
      && result.totalPixelCount !== null
      && result.totalPixelCount > 0
      && result.clearCoveragePercentage !== null;
  }

  private validateSatelliteValues(result: EarthEngineEvaluation): void {
    this.validateRange('NDVI', result.ndvi, -1, 1);
    this.validateRange('NDMI', result.ndmi, -1, 1);
    this.validateRange('NDWI', result.ndwi, -1, 1);
    this.validateRange('EVI', result.evi, -2, 2);
    this.validateRange('SAVI', result.savi, -1.5, 1.5);

    if (result.cloudPercentage !== null && (!Number.isFinite(result.cloudPercentage) || result.cloudPercentage < 0 || result.cloudPercentage > 100)) {
      throw new Error(`Invalid cloud percentage returned by Earth Engine: ${result.cloudPercentage}`);
    }

    if (result.validPixelCount !== null && (!Number.isFinite(result.validPixelCount) || result.validPixelCount < 0)) {
      throw new Error(`Invalid valid pixel count returned by Earth Engine: ${result.validPixelCount}`);
    }

    if (result.totalPixelCount !== null && (!Number.isFinite(result.totalPixelCount) || result.totalPixelCount < 0)) {
      throw new Error(`Invalid total pixel count returned by Earth Engine: ${result.totalPixelCount}`);
    }

    if (result.clearCoveragePercentage !== null && (!Number.isFinite(result.clearCoveragePercentage) || result.clearCoveragePercentage < 0 || result.clearCoveragePercentage > 100)) {
      throw new Error(`Invalid clear coverage percentage returned by Earth Engine: ${result.clearCoveragePercentage}`);
    }

    if (result.observationTime !== null && !Number.isFinite(result.observationTime)) {
      throw new Error('Invalid observation timestamp returned by Earth Engine');
    }
  }

  private validateRange(name: string, value: number | null, min: number, max: number): void {
    if (value !== null && (!Number.isFinite(value) || value < min || value > max)) {
      throw new Error(`Invalid ${name} value returned by Earth Engine: ${value}`);
    }
  }

  private async getOrCreateMapId(cacheOwner: string, geometry: PolygonGeometry, imageId: string, layer: SatelliteMapLayer): Promise<EarthEngineMapId> {
    const cacheKey = this.mapCacheKey(cacheOwner, imageId, layer);
    const cached = this.mapCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.mapId;
    }

    const existingPromise = this.mapCreationPromises.get(cacheKey);

    if (existingPromise) {
      return existingPromise;
    }

    const creationPromise = this.createAndCacheMapId(cacheKey, geometry, imageId, layer);
    this.mapCreationPromises.set(cacheKey, creationPromise);

    try {
      return await creationPromise;
    } finally {
      this.mapCreationPromises.delete(cacheKey);
    }
  }

  private normalizedResult(evaluated: EarthEngineEvaluation, selectionMode: string, lookbackDays: number): NormalizedSatelliteResult {
    this.validateSatelliteValues(evaluated);

    if (!evaluated.observationTime || !evaluated.imageId) {
      throw new Error('Earth Engine observation is missing required metadata');
    }

    const retrievedAt = new Date();
    const scaleMeters = this.configService.get<number>('earthEngine.scaleMeters') ?? 10;

    return {
      provider: SatelliteProvider.GOOGLE_EARTH_ENGINE,
      dataset: SatelliteDataset.SENTINEL_2,
      observationTime: new Date(evaluated.observationTime),
      retrievedAt,
      cloudPercentage: evaluated.cloudPercentage ?? undefined,
      indices: {
        ndvi: evaluated.ndvi ?? undefined,
        ndmi: evaluated.ndmi ?? undefined,
        ndwi: evaluated.ndwi ?? undefined,
        evi: evaluated.evi ?? undefined,
        savi: evaluated.savi ?? undefined,
      },
      metrics: {
        validPixelCount: evaluated.validPixelCount,
        totalPixelCount: evaluated.totalPixelCount,
        clearCoveragePercentage: evaluated.clearCoveragePercentage,
      },
      sourceMetadata: {
        collection: SENTINEL_2_COLLECTION,
        imageId: evaluated.imageId,
        imageAssetId: `${SENTINEL_2_COLLECTION}/${evaluated.imageId}`,
        selectionMode,
        lookbackDays,
        scaleMeters,
      },
      queryVersion: this.queryVersion,
    };
  }

  private async createAndCacheMapId(cacheKey: string, geometry: PolygonGeometry, imageId: string, layer: SatelliteMapLayer): Promise<EarthEngineMapId> {
    await this.ensureAuthenticated();

    const landGeometry = ee.Geometry.Polygon(geometry.coordinates);
    const image = ee.Image(`${SENTINEL_2_COLLECTION}/${imageId}`);
    const indices = this.buildIndices(image, landGeometry);
    const mapImage = this.mapImage(indices, layer);
    const mapId = await this.createMapId(mapImage.image, mapImage.visualization);
    const cacheSeconds = this.configService.get<number>('earthEngine.mapCacheSeconds') ?? 3600;

    this.mapCache.set(cacheKey, {
      mapId,
      expiresAt: Date.now() + cacheSeconds * 1000,
    });

    this.logger.log(`Earth Engine ${layer} map generated for image ${imageId}`);
    return mapId;
  }

  private mapImage(indices: any, layer: SatelliteMapLayer): { image: any; visualization: Record<string, unknown> } {
    switch (layer) {
      case SatelliteMapLayer.NDVI_HEATMAP:
        return {
          image: indices.select('NDVI'),
          visualization: {
            min: -0.2,
            max: 0.8,
            palette: ['8b0000', 'd73027', 'fee08b', 'd9ef8b', '66bd63', '1a9850', '006400'],
            format: 'png',
          },
        };
      case SatelliteMapLayer.NDMI_HEATMAP:
        return {
          image: indices.select('NDMI'),
          visualization: {
            min: -0.5,
            max: 0.6,
            palette: ['8c510a', 'd8b365', 'f6e8c3', 'c7eae5', '5ab4ac', '01665e'],
            format: 'png',
          },
        };
      default:
        throw new Error(`Unsupported satellite map layer: ${layer}`);
    }
  }

  private createMapId(image: any, visualization: Record<string, unknown>): Promise<EarthEngineMapId> {
    return new Promise<EarthEngineMapId>((resolve, reject) => {
      image.getMap(visualization, (mapId: EarthEngineMapId, failure?: unknown) => {
        if (failure) {
          reject(new Error(this.errorMessage(failure)));
          return;
        }

        if (!mapId?.mapid) {
          reject(new Error('Earth Engine did not return a valid map ID'));
          return;
        }

        resolve(mapId);
      });
    });
  }

  private mapCacheKey(cacheOwner: string, imageId: string, layer: SatelliteMapLayer): string {
    return `${cacheOwner}:${imageId}:${layer}`;
  }

  private evaluate<T>(computedObject: { evaluate: (callback: (success: T, failure?: unknown) => void) => void }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      computedObject.evaluate((success: T, failure?: unknown) => {
        if (failure) {
          reject(new Error(this.errorMessage(failure)));
          return;
        }

        resolve(success);
      });
    });
  }

  private extractAccessToken(response: string | { token?: string | null } | null | undefined): string | null {
    if (typeof response === 'string') {
      return response;
    }

    return response?.token ?? null;
  }

  private isRetryable(error: unknown): boolean {
    const message = this.errorMessage(error).toLowerCase();
    return message.includes('429')
      || message.includes('resource_exhausted')
      || message.includes('too many requests')
      || message.includes('timeout')
      || message.includes('timed out')
      || message.includes('deadline')
      || message.includes('503')
      || message.includes('unavailable')
      || message.includes('internal error');
  }

  private retryDelay(attempt: number): number {
    const exponentialDelay = Math.pow(2, attempt) * 1000;
    const jitter = Math.floor(Math.random() * 250);
    return exponentialDelay + jitter;
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private errorMessage(error: unknown): string {
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

  private numberOrNull(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return value;
  }

  private formatNumber(value: number | null): string {
    return value === null ? 'n/a' : value.toFixed(2);
  }

  private mockResult(): NormalizedSatelliteResult {
    const now = new Date();

    return {
      provider: SatelliteProvider.GOOGLE_EARTH_ENGINE,
      dataset: SatelliteDataset.SENTINEL_2,
      observationTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      retrievedAt: now,
      cloudPercentage: 0,
      indices: {
        ndvi: 0.62,
        ndmi: 0.28,
        ndwi: -0.31,
        evi: 0.49,
        savi: 0.57,
      },
      metrics: {
        validPixelCount: 100,
        totalPixelCount: 100,
        clearCoveragePercentage: 100,
      },
      sourceMetadata: {
        mode: 'mock',
        collection: SENTINEL_2_COLLECTION,
      },
      queryVersion: this.queryVersion,
    };
  }
}