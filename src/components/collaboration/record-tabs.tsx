import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CommentsThread } from './comments-thread';
import { ActivityFeed } from './activity-feed';
import type { DiscussionEntity } from '@/lib/collaboration/rules';
export function RecordTabs({entityType,entityId,children}:{entityType:DiscussionEntity;entityId:string;children:ReactNode}) {
  const [tab,setTab]=useState<'details'|'comments'|'history'>('details');
  return <div className="space-y-4"><div role="tablist" aria-label="Record view" className="flex rounded-md bg-muted p-1">{(['details','comments','history'] as const).map(value=><Button key={value} id={`${entityId}-${value}-tab`} role="tab" aria-selected={tab===value} aria-controls={`${entityId}-${value}-panel`} variant={tab===value?'secondary':'ghost'} className="h-8 flex-1" onClick={()=>setTab(value)}>{value.charAt(0).toUpperCase()+value.slice(1)}</Button>)}</div><div role="tabpanel" id={`${entityId}-details-panel`} aria-labelledby={`${entityId}-details-tab`} hidden={tab!=='details'}>{children}</div>{tab==='comments'&&<div role="tabpanel" id={`${entityId}-comments-panel`} aria-labelledby={`${entityId}-comments-tab`}><CommentsThread entityType={entityType} entityId={entityId}/></div>}{tab==='history'&&<div role="tabpanel" id={`${entityId}-history-panel`} aria-labelledby={`${entityId}-history-tab`}><ActivityFeed filters={{entityType:`${entityType}s`,entityId}}/></div>}</div>;
}
