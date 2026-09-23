import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsOptional()
  @IsString()
  parentId?: string

  /** 启用/停用（旧版 dept_status：1启用 0停用），默认启用。层级 level 由服务端按父级+1 计算，不吃入。 */
  @IsOptional()
  enabled?: boolean
}
