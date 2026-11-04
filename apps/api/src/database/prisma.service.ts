import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const EXPECTED_DATABASE = 'tocoffee';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();

    const rows = await this.$queryRaw<
      Array<{ current_database: string }>
    >`SELECT current_database() AS current_database`;

    const databaseName = rows[0]?.current_database;
    if (databaseName !== EXPECTED_DATABASE) {
      await this.$disconnect();
      throw new Error(
        `Refusing to start: connected to database "${String(
          databaseName,
        )}", expected "${EXPECTED_DATABASE}"`,
      );
    }

    this.logger.log(`Connected to database ${databaseName}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
