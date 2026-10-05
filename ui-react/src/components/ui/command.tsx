import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command as CommandPrimitive } from 'cmdk'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { DialogContent, DialogTitle } from '@/components/ui/dialog'

export const Command = ({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) => (
  <CommandPrimitive className={cn('flex size-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground', className)} {...props} />
)

export function CommandDialog({ children, ...props }: DialogPrimitive.DialogProps) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]" />
        <DialogContent className="overflow-hidden p-0">
          <DialogTitle className="sr-only">命令面板</DialogTitle>
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:size-4">
            {children}
          </Command>
        </DialogContent>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3">
      <MagnifyingGlass size={16} className="shrink-0 opacity-50" />
      <CommandPrimitive.Input
        className={cn('flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50', className)}
        {...props}
      />
    </div>
  )
}

export function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn('max-h-72 overflow-y-auto overflow-x-hidden p-1', className)} {...props} />
}

export function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className={cn('py-6 text-center text-sm text-muted-foreground', className)} {...props} />
}

export function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return <CommandPrimitive.Group className={cn('overflow-hidden py-1 text-foreground', className)} {...props} />
}

export function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
}

export function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-muted',
        className,
      )}
      {...props}
    />
  )
}

export function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('ml-auto text-xs text-muted-foreground', className)} {...props} />
}
