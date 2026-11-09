import { WidgetOpenHandler } from '@theia/core/lib/browser/widget-open-handler';
import URI from '@theia/core/lib/common/uri';
import { ProtoAppEditorOptions, ProtoAppEditorWidget } from './proto-app-editor-widget';
/** Ouvre les fichiers *.protoapp dans l'éditeur ProtoIDE (prioritaire sur l'éditeur texte). */
export declare class ProtoAppOpenHandler extends WidgetOpenHandler<ProtoAppEditorWidget> {
    readonly id = "proto-app-editor";
    readonly label = "\u00C9diteur d'application ProtoIDE";
    canHandle(uri: URI): number;
    protected createWidgetOptions(uri: URI): ProtoAppEditorOptions;
}
//# sourceMappingURL=proto-app-open-handler.d.ts.map