import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { OpenHandler, WidgetFactory } from '@theia/core/lib/browser';
import { ProtoAppEditorOptions, ProtoAppEditorWidget } from './proto-app-editor-widget';
import { ProtoAppOpenHandler } from './proto-app-open-handler';
import { ProtoIdeContribution } from './proto-ide-contribution';
// tsc ne copie pas les .css : on référence la source (chemin valide depuis src/ et lib/).
import '../../src/browser/style/proto-ide.css';

export default new ContainerModule(bind => {
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: ProtoAppEditorWidget.ID,
        createWidget: (options: ProtoAppEditorOptions) => {
            const child = ctx.container.createChild();
            child.bind(ProtoAppEditorOptions).toConstantValue(options);
            child.bind(ProtoAppEditorWidget).toSelf();
            return child.get(ProtoAppEditorWidget);
        }
    })).inSingletonScope();

    bind(ProtoAppOpenHandler).toSelf().inSingletonScope();
    bind(OpenHandler).toService(ProtoAppOpenHandler);

    bind(ProtoIdeContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(ProtoIdeContribution);
    bind(MenuContribution).toService(ProtoIdeContribution);
});
