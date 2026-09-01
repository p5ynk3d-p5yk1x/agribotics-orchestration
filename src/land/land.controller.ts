import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.auth-guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { CreateLandDto } from './dtos/create-land.dto';
import { SatelliteMapLayer } from './enums/satellite.enum';
import { LandService } from './services/land.service';

@Controller('/api/land')
@UseGuards(JwtAuthGuard)
export class LandController {
  constructor(private readonly landService: LandService) {}

  @Get('current')
  getCurrent(@CurrentUser() user: JwtUser) {
    return this.landService.getCurrent(user.userId);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateLandDto) {
    return this.landService.create(user.userId, dto);
  }

  @Delete('current')
  deleteCurrent(@CurrentUser() user: JwtUser) {
    return this.landService.deleteCurrent(user.userId);
  }

  @Get('current/satellite')
  getSatellite(@CurrentUser() user: JwtUser) {
    return this.landService.getCurrent(user.userId);
  }

  @Post('current/satellite/refresh')
  refresh(@CurrentUser() user: JwtUser) {
    return this.landService.refresh(user.userId);
  }

  @Get('current/satellite/history')
  history(@CurrentUser() user: JwtUser, @Query('limit') limit?: string) {
    return this.landService.history(user.userId, limit ? Number(limit) : 30);
  }

  @Get('current/maps')
  getMaps(@CurrentUser() user: JwtUser) {
    return this.landService.getMapLayers(user.userId);
  }

  @Get('current/maps/:layer/tiles/:z/:x/:y')
  async getMapTile(@CurrentUser() user: JwtUser, @Param('layer', new ParseEnumPipe(SatelliteMapLayer)) layer: SatelliteMapLayer, @Param('z', ParseIntPipe) z: number, @Param('x', ParseIntPipe) x: number, @Param('y', ParseIntPipe) y: number, @Res() response: Response) {
    const tileUrl = await this.landService.getMapTile(user.userId, layer, z, x, y);
    return response.redirect(tileUrl);
  }
}