import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma.module'
import { AuthModule } from '../auth/auth.module'
import { ProductController } from './product.controller'
import { ProductService } from './product.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductsApiModule {}