import { IsOptional, IsString } from 'class-validator'

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  parentId?: string

  /** 启用/停用（旧版 dept_status）。层级 level 变更父级时由服务端自动重算。 */
  @IsOptional()
  enabled?: boolean
}
