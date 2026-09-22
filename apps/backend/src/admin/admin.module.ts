import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { DataScopeGuard } from '../auth/data-scope.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionGuard } from '../auth/permission.guard'
import { PrismaModule } from '../prisma.module'
import { DepartmentController } from './department.controller'
import { DepartmentService } from './department.service'
import { PlatformController } from './platform.controller'
import { PlatformService } from './platform.service'
import { PermissionController } from './permission.controller'
import { ProviderProfileController } from './provider-profile.controller'
import { ProviderProfileService } from './provider-profile.service'
import { RoleController } from './role.controller'
import { RoleService } from './role.service'
import { StoreController } from './store.controller'
import { StoreLegacyController } from './store-legacy.controller'
import { StoreService } from './store.service'
import { TenantController } from './tenant.controller'
import { TenantService } from './tenant.service'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [UserController, RoleController, PermissionController, TenantController, DepartmentController, StoreController, StoreLegacyController, PlatformController, ProviderProfileController],
  providers: [JwtAuthGuard, PermissionGuard, DataScopeGuard, UserService, RoleService, DepartmentService, StoreService, PlatformService, ProviderProfileService, TenantService],
})
export class AdminModule {}
