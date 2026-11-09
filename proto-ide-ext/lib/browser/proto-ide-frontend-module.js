"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const common_1 = require("@theia/core/lib/common");
const browser_1 = require("@theia/core/lib/browser");
const proto_app_editor_widget_1 = require("./proto-app-editor-widget");
const proto_app_open_handler_1 = require("./proto-app-open-handler");
const proto_ide_contribution_1 = require("./proto-ide-contribution");
// tsc ne copie pas les .css : on référence la source (chemin valide depuis src/ et lib/).
require("../../src/browser/style/proto-ide.css");
exports.default = new inversify_1.ContainerModule(bind => {
    bind(browser_1.WidgetFactory).toDynamicValue(ctx => ({
        id: proto_app_editor_widget_1.ProtoAppEditorWidget.ID,
        createWidget: (options) => {
            const child = ctx.container.createChild();
            child.bind(proto_app_editor_widget_1.ProtoAppEditorOptions).toConstantValue(options);
            child.bind(proto_app_editor_widget_1.ProtoAppEditorWidget).toSelf();
            return child.get(proto_app_editor_widget_1.ProtoAppEditorWidget);
        }
    })).inSingletonScope();
    bind(proto_app_open_handler_1.ProtoAppOpenHandler).toSelf().inSingletonScope();
    bind(browser_1.OpenHandler).toService(proto_app_open_handler_1.ProtoAppOpenHandler);
    bind(proto_ide_contribution_1.ProtoIdeContribution).toSelf().inSingletonScope();
    bind(common_1.CommandContribution).toService(proto_ide_contribution_1.ProtoIdeContribution);
    bind(common_1.MenuContribution).toService(proto_ide_contribution_1.ProtoIdeContribution);
});
//# sourceMappingURL=proto-ide-frontend-module.js.map