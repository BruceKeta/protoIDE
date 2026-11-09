import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry, MessageService } from '@theia/core/lib/common';
import { OpenerService } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileDialogService } from '@theia/filesystem/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
export declare namespace ProtoIdeCommands {
    const NEW_APPLICATION: Command;
    const OPEN_APPLICATION: Command;
}
export declare class ProtoIdeContribution implements CommandContribution, MenuContribution {
    protected readonly fileService: FileService;
    protected readonly fileDialogService: FileDialogService;
    protected readonly workspaceService: WorkspaceService;
    protected readonly openerService: OpenerService;
    protected readonly messageService: MessageService;
    registerCommands(registry: CommandRegistry): void;
    registerMenus(menus: MenuModelRegistry): void;
    protected newApplication(): Promise<void>;
    protected openApplication(): Promise<void>;
}
//# sourceMappingURL=proto-ide-contribution.d.ts.map