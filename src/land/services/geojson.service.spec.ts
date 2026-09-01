import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { GeojsonService } from './geojson.service';

describe('GeojsonService', () => {
  const service = new GeojsonService({
    get: (key: string) => ({ 'land.maxVertices': 100 })[key],
  } as ConfigService);

  it('preserves GeoJSON longitude-latitude coordinate order', () => {
    const result = service.validatePolygon({
      type: 'Polygon',
      coordinates: [
        [
          [78.123, 21.123],
          [78.124, 21.123],
          [78.124, 21.124],
          [78.123, 21.124],
          [78.123, 21.123],
        ],
      ],
    });

    expect(result.geometry.coordinates[0][0]).toEqual([78.123, 21.123]);
    expect(result.centroid.coordinates[0]).toBeGreaterThan(78);
    expect(result.centroid.coordinates[1]).toBeGreaterThan(21);
  });

  it('rejects latitude values in the longitude slot when coordinate order is likely reversed', () => {
    expect(() =>
      service.validatePolygon({
        type: 'Polygon',
        coordinates: [
          [
            [21.123, 78.123],
            [21.124, 78.123],
            [21.124, 91.124],
            [21.123, 91.124],
            [21.123, 78.123],
          ],
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects self-intersecting polygons', () => {
    expect(() =>
      service.validatePolygon({
        type: 'Polygon',
        coordinates: [
          [
            [78, 21],
            [79, 22],
            [78, 22],
            [79, 21],
            [78, 21],
          ],
        ],
      }),
    ).toThrow(BadRequestException);
  });
});
