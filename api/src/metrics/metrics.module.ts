import { Module } from '@nestjs/common';
import { lambdaClientProvider } from './lambda.provider';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [lambdaClientProvider, MetricsService],
})
export class MetricsModule {}
