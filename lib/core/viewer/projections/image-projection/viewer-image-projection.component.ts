import { Version, VersionEntry, Node } from '@alfresco/js-api';
import { Component, OnDestroy } from '@angular/core';
import { HyViewerContentItemInfo } from '@hyland/ui';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { AlfrescoApiService } from '../../../services/alfresco-api.service';
import { ContentService } from '../../../services/content.service';

@Component({
    selector: 'adf-image-projection',
    templateUrl: './viewer-image-projection.component.html'
})
export class ViewerImageProjectionComponent implements OnDestroy {
    private docMeta = this.contentItemInfo.document.metadata;
    public readonly imageSrc$:Observable<string> = this.contentItemInfo.contentItem$.pipe(
        switchMap(() => this.getNodeEntry(this.docMeta.documentId)),
        switchMap(({node, version}) => this.setUpNodeFile(node.entry, version?.entry))
    );

    public readOnly = false;
    public mimeType:string;

    constructor(
        private contentItemInfo:HyViewerContentItemInfo,
        private api:AlfrescoApiService,
        private contentService:ContentService
    ){

    }
    public ngOnDestroy(){
    }

    private getNodeEntry(nodeId:string, versionId?:string){
        const nodePromise = this.api.nodesApi.getNode(nodeId, { include: ['allowableOperations'] });
        const versionPromise:Promise<VersionEntry|undefined> = versionId ? this.api.versionsApi.getVersion(nodeId, versionId) : Promise.resolve(undefined);
        const p = Promise.all([
            nodePromise,
            versionPromise
        ])
        .then(([node, version]) => ({
            node,
            version
        }));

        return from(p);
    }

    private async setUpNodeFile(nodeData: Node, versionData?: Version) {
        this.readOnly = !this.contentService.hasAllowableOperations(nodeData, 'update');

        if (versionData && versionData.content) {
            this.mimeType = versionData.content.mimeType;
        } else if (nodeData.content) {
            this.mimeType = nodeData.content.mimeType;
        }

        const currentFileVersion = nodeData?.properties &&  nodeData.properties['cm:versionLabel'] ?
            encodeURI(nodeData?.properties['cm:versionLabel']) :
            encodeURI('1.0');

        let urlFileContent = versionData ?
            this.api.contentApi.getVersionContentUrl(this.docMeta.documentId, versionData.id) :
            this.api.contentApi.getContentUrl(this.docMeta.documentId);

        urlFileContent += `&${currentFileVersion}`;

        return urlFileContent;
    }
}
