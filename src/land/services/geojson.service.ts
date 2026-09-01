import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Position = [number, number];
export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Position[][];
}
export interface PointGeometry {
  type: 'Point';
  coordinates: Position;
}
export interface ValidatedLandGeometry {
  geometry: PolygonGeometry;
  areaSqMeters: number;
  centroid: PointGeometry;
}

const EARTH_RADIUS_METERS = 6371008.8;

@Injectable()
export class GeojsonService {
  constructor(private readonly configService: ConfigService) {}

  validatePolygon(input: PolygonGeometry): ValidatedLandGeometry {
    if (
      !input ||
      input.type !== 'Polygon' ||
      !Array.isArray(input.coordinates) ||
      input.coordinates.length !== 1
    ) {
      throw new BadRequestException(
        'Only single-ring GeoJSON Polygon geometries are supported',
      );
    }
    const maxVertices =
      this.configService.get<number>('land.maxVertices') ?? 100;
    const ring = input.coordinates[0];
    if (
      !Array.isArray(ring) ||
      ring.length < 4 ||
      ring.length > maxVertices + 1
    ) {
      throw new BadRequestException(
        `Polygon must contain 3-${maxVertices} unique vertices and a closing coordinate`,
      );
    }
    const normalized = ring.map((point) => this.validatePosition(point));
    if (!this.samePosition(normalized[0], normalized[normalized.length - 1])) {
      normalized.push([...normalized[0]] as Position);
    }
    const unique = new Set(
      normalized.slice(0, -1).map(([lon, lat]) => `${lon},${lat}`),
    );
    if (unique.size < 3)
      throw new BadRequestException(
        'Polygon must contain at least 3 unique vertices',
      );
    this.assertNoSelfIntersections(normalized);
    const areaSqMeters = Math.abs(this.planarSignedArea(normalized));
    if (!Number.isFinite(areaSqMeters) || areaSqMeters <= 0)
      throw new BadRequestException('Polygon area must be greater than zero');
    this.assertAreaInRange(areaSqMeters);
    return {
      geometry: { type: 'Polygon', coordinates: [normalized] },
      areaSqMeters,
      centroid: this.centroid(normalized),
    };
  }

  private validatePosition(point: unknown): Position {
    if (!Array.isArray(point) || point.length !== 2)
      throw new BadRequestException(
        'Coordinates must be [longitude, latitude] pairs',
      );
    const coordinates = point as readonly unknown[];
    const lon = coordinates[0];
    const lat = coordinates[1];
    if (
      typeof lon !== 'number' ||
      typeof lat !== 'number' ||
      !Number.isFinite(lon) ||
      !Number.isFinite(lat)
    )
      throw new BadRequestException('Coordinates must be finite numbers');
    if (lon < -180 || lon > 180)
      throw new BadRequestException('Longitude must be between -180 and 180');
    if (lat < -90 || lat > 90)
      throw new BadRequestException('Latitude must be between -90 and 90');
    return [lon, lat];
  }

  private assertAreaInRange(areaSqMeters: number) {
    const hectares = areaSqMeters / 10000;
    const min = this.configService.get<number>('land.minAreaHectares');
    const max = this.configService.get<number>('land.maxAreaHectares');
    if (min !== undefined && hectares < min)
      throw new BadRequestException(
        `Polygon area must be at least ${min} hectares`,
      );
    if (max !== undefined && hectares > max)
      throw new BadRequestException(
        `Polygon area must be at most ${max} hectares`,
      );
  }

  private samePosition(a: Position, b: Position) {
    return a[0] === b[0] && a[1] === b[1];
  }

  private project([lon, lat]: Position): [number, number] {
    const x =
      ((lon * Math.PI) / 180) *
      EARTH_RADIUS_METERS *
      Math.cos((lat * Math.PI) / 180);
    const y = ((lat * Math.PI) / 180) * EARTH_RADIUS_METERS;
    return [x, y];
  }

  private planarSignedArea(ring: Position[]): number {
    const pts = ring.map((p) => this.project(p));
    return (
      pts.slice(0, -1).reduce((sum, [x1, y1], i) => {
        const [x2, y2] = pts[i + 1];
        return sum + (x1 * y2 - x2 * y1);
      }, 0) / 2
    );
  }

  private centroid(ring: Position[]): PointGeometry {
    const pts = ring.slice(0, -1);
    const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return { type: 'Point', coordinates: [lon, lat] };
  }

  private assertNoSelfIntersections(ring: Position[]) {
    for (let i = 0; i < ring.length - 1; i++) {
      for (let j = i + 1; j < ring.length - 1; j++) {
        if (Math.abs(i - j) <= 1 || (i === 0 && j === ring.length - 2))
          continue;
        if (this.intersects(ring[i], ring[i + 1], ring[j], ring[j + 1]))
          throw new BadRequestException(
            'Polygon edges must not self-intersect',
          );
      }
    }
  }

  private intersects(a: Position, b: Position, c: Position, d: Position) {
    const orient = (p: Position, q: Position, r: Position) =>
      Math.sign((q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]));
    return (
      orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b)
    );
  }
}
