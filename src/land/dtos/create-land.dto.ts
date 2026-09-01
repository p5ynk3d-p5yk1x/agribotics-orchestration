import { IsObject } from 'class-validator';
import type { PolygonGeometry } from '../services/geojson.service';

export class CreateLandDto {
  @IsObject()
  geometry!: PolygonGeometry;
}
