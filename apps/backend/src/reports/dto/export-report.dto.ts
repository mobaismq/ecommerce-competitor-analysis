import { IsIn } from 'class-validator'
import { EXPORT_FORMATS } from '../report-export.service'

export class ExportReportDto {
  @IsIn(EXPORT_FORMATS)
  format!: (typeof EXPORT_FORMATS)[number]
}
