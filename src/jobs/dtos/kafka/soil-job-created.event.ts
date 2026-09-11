import { JobType } from '../../enums/job-type.enum';

export interface SoilJobCreatedEvent {
  jobId: string;
  userId: string;
  jobType: JobType.SOIL;
  latitude: number;
  longitude: number;
  nitrogenLevel: number;
  potassiumLevel: number;
  phosphorousLevel: number;
  organicCarbonLevel: number;
  ironLevel?: number;
  zincLevel?: number;
  manganeseLevel?: number;
  copperLevel?: number;
  boronLevel?: number;
  sulphurLevel?: number;
  salinityLevel?: number;
  electricalConductivity?: number;
  pH?: number;
  createdAt: string;
}