/*!
 * @license
 * Copyright 2019 Alfresco Software, Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* tslint:disable:component-selector */

import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import {
    FormService,
    LogService,
    ThumbnailService,
    NotificationService,
    FormValues,
    ContentLinkModel,
    AppConfigService,
    AlfrescoApiService,
    UploadWidgetContentLinkModel
} from '@alfresco/adf-core';
import { Node, NodesApi, RelatedContentRepresentation } from '@alfresco/js-api';
import { ContentCloudNodeSelectorService } from '../../../services/content-cloud-node-selector.service';
import { ProcessCloudContentService } from '../../../services/process-cloud-content.service';
import { UploadCloudWidgetComponent } from './upload-cloud.widget';
import { DestinationFolderPathModel, DestinationFolderPathType } from '../../../models/form-cloud-representation.model';
import { ContentNodeSelectorPanelService } from '@alfresco/adf-content-services';

@Component({
    selector: 'adf-cloud-attach-file-cloud-widget',
    templateUrl: './attach-file-cloud-widget.component.html',
    host: {
        '(click)': 'event($event)',
        '(blur)': 'event($event)',
        '(change)': 'event($event)',
        '(focus)': 'event($event)',
        '(focusin)': 'event($event)',
        '(focusout)': 'event($event)',
        '(input)': 'event($event)',
        '(invalid)': 'event($event)',
        '(select)': 'event($event)'
    },
    encapsulation: ViewEncapsulation.None
})
export class AttachFileCloudWidgetComponent extends UploadCloudWidgetComponent implements OnInit, OnDestroy {

    static ALIAS_ROOT_FOLDER = '-root-';
    static ALIAS_USER_FOLDER = '-my-';
    static APP_NAME = '-appname-';
    static VALID_ALIAS = [
        AttachFileCloudWidgetComponent.ALIAS_ROOT_FOLDER,
        AttachFileCloudWidgetComponent.ALIAS_USER_FOLDER, '-shared-'
    ];
    static RETRIEVE_METADATA_OPTION = 'retrieveMetadata';

    typeId = 'AttachFileCloudWidgetComponent';
    rootNodeId = AttachFileCloudWidgetComponent.ALIAS_USER_FOLDER;
    selectedNode: Node;

    _nodesApi: NodesApi;
    get nodesApi(): NodesApi {
        this._nodesApi = this._nodesApi ?? new NodesApi(this.apiService.getInstance());
        return this._nodesApi;
    }

    constructor(
        formService: FormService,
        logger: LogService,
        thumbnails: ThumbnailService,
        processCloudContentService: ProcessCloudContentService,
        notificationService: NotificationService,
        private contentNodeSelectorService: ContentCloudNodeSelectorService,
        private appConfigService: AppConfigService,
        private apiService: AlfrescoApiService,
        private contentNodeSelectorPanelService: ContentNodeSelectorPanelService
    ) {
        super(formService, thumbnails, processCloudContentService, notificationService, logger);
    }

    ngOnInit() {
        super.ngOnInit();
        if (this.hasFile && this.field.value.length === 1) {
            const files = this.field.value || this.field.form.values[this.field.id];
            this.contentModelFormFileHandler(files[0]);
        }
    }

    isPathStaticType(): boolean {
        return this.field.params?.fileSource?.destinationFolderPath?.type === DestinationFolderPathType.STATIC_TYPE;
    }

    isUploadButtonVisible(): boolean {
        return (!this.hasFile || this.multipleOption) && !this.field.readOnly;
    }

    onRemoveAttachFile(file: File | RelatedContentRepresentation | Node) {
        this.removeFile(file);
        if (file['id'] === this.selectedNode?.id) {
            this.selectedNode = null;
            this.contentModelFormFileHandler();
        }
    }

    fetchAppNameFromAppConfig(): string {
        return this.appConfigService.get('alfresco-deployed-apps')[0]?.name;
    }

    replaceAppNameAliasWithValue(path: string): string {
        if (path?.match(AttachFileCloudWidgetComponent.APP_NAME)) {
            const appName = this.fetchAppNameFromAppConfig();
            return path.replace(AttachFileCloudWidgetComponent.APP_NAME, appName);
        }
        return path;
    }

    async openSelectDialog() {
        const selectedMode = this.field.params.multiple ? 'multiple' : 'single';
        const nodeId = await this.getDestinationFolderNodeId();
        this.rootNodeId = nodeId ? nodeId : AttachFileCloudWidgetComponent.ALIAS_USER_FOLDER;
        this.contentNodeSelectorPanelService.customModels = this.field.params.customModels;

        this.contentNodeSelectorService
            .openUploadFileDialog(this.rootNodeId, selectedMode, this.isAlfrescoAndLocal(), true)
            .subscribe((selections: Node[]) => {
                selections.forEach(node => (node['isExternal'] = true));
                const selectionWithoutDuplication = this.removeExistingSelection(selections);
                this.fixIncompatibilityFromPreviousAndNewForm(selectionWithoutDuplication);
                if (this.field.value.length === 1) {
                    this.contentModelFormFileHandler(selections && selections.length > 0 ? selections[0] : null);
                }
            });
    }

    private async getDestinationFolderNodeId(): Promise<string> {
        let rootNodeId: string;
        let destinationFolderPath = <DestinationFolderPathModel> { alias: AttachFileCloudWidgetComponent.ALIAS_USER_FOLDER, path: '' };
        if (this.isAlfrescoAndLocal() && this.hasDestinationFolder()) {
            if (this.isPathVariableType(DestinationFolderPathType.STRING_TYPE) || this.isPathStaticType()) {
                destinationFolderPath = this.getAliasAndRelativePathFromDestinationFolderPath(this.field.params.fileSource.destinationFolderPath.value);
                destinationFolderPath.path = this.replaceAppNameAliasWithValue(destinationFolderPath.path);
            }

            if (this.isPathVariableType(DestinationFolderPathType.FOLDER_TYPE)) {
                rootNodeId = this.field.params.fileSource.destinationFolderPath.value;
            }
        }

        if (!rootNodeId) {
            try {
                const nodeId = await this.getNodeIdBasedOnPath(destinationFolderPath);
                rootNodeId = nodeId ? nodeId : destinationFolderPath.alias;
            } catch (error) {
                this.logService.error(error);
            }
        }

        return rootNodeId;
    }

    private async getNodeIdBasedOnPath(destinationFolderPath: DestinationFolderPathModel) {
        let nodeId: string;
        if (destinationFolderPath.path) {
            nodeId = await this.contentNodeSelectorService.fetchNodeIdFromRelativePath(destinationFolderPath.alias, { relativePath: destinationFolderPath.path });
        }
        if (!nodeId) {
            nodeId = await this.contentNodeSelectorService.fetchAliasNodeId(destinationFolderPath.alias);
        }

        return nodeId;
    }

    getAliasAndRelativePathFromDestinationFolderPath(destinationFolderPath: string): DestinationFolderPathModel {
        let alias: string; let path: string;
        if (destinationFolderPath) {
            const startOfRelativePathIndex = destinationFolderPath.indexOf('/');
            if (startOfRelativePathIndex >= 0) {
                alias = destinationFolderPath.substring(0, startOfRelativePathIndex);
                path = destinationFolderPath.substring(startOfRelativePathIndex, destinationFolderPath.length);
            } else {
                alias = destinationFolderPath;
            }
        }

        return this.isValidAlias(alias) ? { alias, path } : { alias: AttachFileCloudWidgetComponent.ALIAS_USER_FOLDER, path: undefined };
    }

    removeExistingSelection(selections: Node[]) {
        const existingNode: Node[] = [...this.field.value || []];
        return selections.filter(opt => !existingNode.some((node) => node.id === opt.id));
    }

    downloadContent(file: Node): void {
        this.processCloudContentService.downloadFile(file.id);
    }

    onAttachFileClicked(nodeSelector: any) {
        nodeSelector.nodeId = nodeSelector.id;
        this.fileClicked(new ContentLinkModel(nodeSelector));
    }

    getWidgetIcon(): string {
        return this.isAlfrescoAndLocal() ? 'file_upload' : 'attach_file';
    }

    displayMenuOption(option: string): boolean {
        return this.field?.params?.menuOptions ? this.field.params.menuOptions[option] : option !== AttachFileCloudWidgetComponent.RETRIEVE_METADATA_OPTION;
    }

    onRowClicked(file?: Node) {
        if (this.selectedNode?.id === file?.id) {
            this.selectedNode = null;
        } else {
            this.selectedNode = file;
        }
        this.contentModelFormFileHandler(this.selectedNode);
    }

    contentModelFormFileHandler(file?: any) {
        if (file?.id && this.isRetrieveMetadataOptionEnabled()) {
            const values: FormValues = {};
            this.nodesApi.getNode(file.id).then(acsNode => {
                const metadata = acsNode?.entry?.properties;
                if (metadata) {
                    const keys = Object.keys(metadata);
                    keys.forEach(key => {
                        const sanitizedKey = key.replace(':', '_');
                        values[sanitizedKey] = metadata[key];
                    });
                    this.formService.updateFormValuesRequested.next(values);
                }
            });
        }
        this.fileClicked(new UploadWidgetContentLinkModel(file, this.field.id));
    }

    isRetrieveMetadataOptionEnabled(): boolean {
        return this.field?.params?.menuOptions && this.field.params.menuOptions[AttachFileCloudWidgetComponent.RETRIEVE_METADATA_OPTION];
    }

    isValidAlias(alias: string): boolean {
        return alias && AttachFileCloudWidgetComponent.VALID_ALIAS.includes(alias);
    }

    private hasDestinationFolder(): boolean {
        return !!this.field?.params?.fileSource?.destinationFolderPath?.value;
    }

    ngOnDestroy() {
        this.contentNodeSelectorPanelService.customModels = [];
    }
}
