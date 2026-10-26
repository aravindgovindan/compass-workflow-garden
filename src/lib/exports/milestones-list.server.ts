import { z } from "zod";
import type { Db } from "@/lib/project-access.server";
import { fail } from "@/lib/project-access.server";
import { milestoneSummarySchema, summarizeMilestone } from "@/lib/dashboard/rules";
export async function milestoneRows(db:Db,projectId:string){const r=await db.rpc('milestone_summaries',{_project_id:projectId});if(r.error)fail('load the milestones',r.error);return z.array(milestoneSummarySchema).parse(r.data).map(row=>summarizeMilestone(row));}