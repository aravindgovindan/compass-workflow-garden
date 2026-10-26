import type { ReactNode } from 'react';
import { Tabs,TabsList,TabsTrigger,TabsContent } from '@/components/ui/tabs';
import { CommentsThread } from './comments-thread';
import { ActivityFeed } from './activity-feed';
import type { DiscussionEntity } from '@/lib/collaboration/rules';
export function RecordTabs({entityType,entityId,children}:{entityType:DiscussionEntity;entityId:string;children:ReactNode}) {
  return <Tabs defaultValue="details" className="space-y-4"><TabsList className="w-full"><TabsTrigger value="details" className="flex-1">Details</TabsTrigger><TabsTrigger value="comments" className="flex-1">Comments</TabsTrigger><TabsTrigger value="history" className="flex-1">History</TabsTrigger></TabsList><TabsContent value="details">{children}</TabsContent><TabsContent value="comments"><CommentsThread entityType={entityType} entityId={entityId}/></TabsContent><TabsContent value="history"><ActivityFeed filters={{entityType:`${entityType}s`,entityId}}/></TabsContent></Tabs>;
}
