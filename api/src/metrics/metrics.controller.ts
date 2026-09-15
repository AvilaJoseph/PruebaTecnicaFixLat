import { Controller, Get } from '@nestjs/common';
import { MetricsService, type LambdaMetrics } from './metrics.service';

export interface MetricsResponse extends LambdaMetrics {
  source: 'lambda';
}

/** Métricas del dashboard. Exige sesión (guard global); ambos roles pueden verlas. */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(): Promise<MetricsResponse> {
    const metrics = await this.metricsService.getMetrics();
    return { ...metrics, source: 'lambda' };
  }
}
