import { useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { mentionToken } from '@/lib/collaboration/rules';
export function MentionEditor({value,onChange,members,disabled=false,id}:{value:string;onChange:(v:string)=>void;members:{user_id:string;full_name:string}[];disabled?:boolean;id:string}) {
  const ref = useRef<HTMLTextAreaElement>(null); const [cursor,setCursor] = useState(0); const [selected,setSelected] = useState(0); const [dismissed,setDismissed] = useState(false);
  const match = value.slice(0,cursor).match(/(?:^|\s)@([^@\[\]\n]*)$/);
  const query = match?.[1]; const candidates = query !== undefined && !dismissed ? members.filter(m => m.full_name.toLowerCase().includes(query.toLowerCase())).slice(0,6) : [];
  function choose(person:{user_id:string;full_name:string}) {
    if(query === undefined) return;
    const start = cursor-query.length-1; const token = mentionToken(person.full_name,person.user_id)+' ';
    onChange(value.slice(0,start)+token+value.slice(cursor)); setDismissed(true);
    requestAnimationFrame(() => {ref.current?.focus();ref.current?.setSelectionRange(start+token.length,start+token.length);});
  }
  return <div className="relative space-y-1">
    <Textarea ref={ref} id={id} aria-label="Comment" value={value} disabled={disabled} maxLength={10000} rows={3} aria-autocomplete="list" aria-controls={candidates.length ? `${id}-suggestions` : undefined}
      onChange={e => {onChange(e.target.value);setCursor(e.target.selectionStart);setSelected(0);setDismissed(false);}}
      onClick={e => setCursor(e.currentTarget.selectionStart)}
      onKeyDown={e => {if(!candidates.length)return;if(e.key==='Escape'){setDismissed(true);e.preventDefault();}if(e.key==='ArrowDown'){setSelected(i=>(i+1)%candidates.length);e.preventDefault();}if(e.key==='ArrowUp'){setSelected(i=>(i+candidates.length-1)%candidates.length);e.preventDefault();}if(e.key==='Enter'&&!e.shiftKey){const p=candidates[selected];if(p){choose(p);e.preventDefault();}}}} />
    {!!candidates.length && <div id={`${id}-suggestions`} role="listbox" aria-label="Mention a person" className="rounded-md border bg-popover p-1 shadow-sm">
      {candidates.map((p,i) => <Button key={p.user_id} role="option" aria-selected={i===selected} variant={i===selected?'secondary':'ghost'} className="w-full justify-start" onClick={() => choose(p)}>{p.full_name}</Button>)}
    </div>}
  </div>;
}
