import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/exports/download";
import { useTerm } from "@/lib/terminology/use-term";
import type { ExportKind } from "@/lib/exports/csv";
type FileResult={csv:string;filename:string;count:number};
export function ExportButton<T>({kind,fn,data}:{kind:ExportKind;fn:(opts:{data:T})=>Promise<FileResult>;data:T}){
 const term=useTerm();const call=useServerFn(fn);const [file,setFile]=useState<FileResult|null>(null);
 const mutation=useMutation({mutationFn:()=>call({data}),onSuccess:result=>{if(matchMedia('(pointer: coarse)').matches)setFile(result);else downloadCsv(result.csv,result.filename);}});
 return <div className="flex flex-col items-end gap-1"><Button variant="outline" size="sm" disabled={mutation.isPending} aria-label={`Export ${term(kind)}`} onClick={()=>{if(file){downloadCsv(file.csv,file.filename);setFile(null);}else mutation.mutate();}}>{mutation.isPending?<LoaderCircle className="size-4 animate-spin"/>:<Download className="size-4"/>}{mutation.isPending?'Exporting…':file?'Download CSV':'Export'}</Button>{mutation.error&&<p role="alert" className="max-w-56 text-xs text-destructive">{mutation.error.message}</p>}</div>;
}