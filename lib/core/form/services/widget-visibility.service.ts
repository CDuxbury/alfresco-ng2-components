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

import { AlfrescoApiService } from '../../services/alfresco-api.service';
import { LogService } from '../../services/log.service';
import { Injectable } from '@angular/core';
import moment from 'moment-es6';
import { Observable, from, throwError } from 'rxjs';
import {
    FormFieldModel,
    FormModel,
    TabModel,
    ContainerModel,
    FormOutcomeModel
} from '../components/widgets/core/index';
import { TaskProcessVariableModel } from '../models/task-process-variable.model';
import { WidgetVisibilityModel, WidgetTypeEnum } from '../models/widget-visibility.model';
import { map, catchError } from 'rxjs/operators';
import { TaskFormsApi } from '@alfresco/js-api';

@Injectable({
    providedIn: 'root'
})
export class WidgetVisibilityService {

    _taskFormsApi: TaskFormsApi;
    get taskFormsApi(): TaskFormsApi {
        this._taskFormsApi = this._taskFormsApi ?? new TaskFormsApi(this.apiService.getInstance());
        return this._taskFormsApi;
    }

    private processVarList: TaskProcessVariableModel[];
    private form: FormModel;

    constructor(private apiService: AlfrescoApiService,
                private logService: LogService) {
    }

    public refreshVisibility(form: FormModel, processVarList?: TaskProcessVariableModel[]) {
        this.form = form;
        if (processVarList) {
            this.processVarList = processVarList;
        }
        if (form && form.tabs && form.tabs.length > 0) {
            form.tabs.map((tabModel) => this.refreshEntityVisibility(tabModel));
        }

        if (form && form.outcomes && form.outcomes.length > 0) {
            form.outcomes.map((outcomeModel) => this.refreshOutcomeVisibility(outcomeModel));
        }

        if (form) {
            form.getFormFields().map((field) => this.refreshEntityVisibility(field));
        }
    }

    refreshEntityVisibility(element: FormFieldModel | TabModel) {
        const visible = this.evaluateVisibility(element.form, element.visibilityCondition);
        element.isVisible = visible && this.isParentTabVisible(this.form, element);
    }

    refreshOutcomeVisibility(element: FormOutcomeModel) {
        element.isVisible = this.evaluateVisibility(element.form, element.visibilityCondition);
    }

    evaluateVisibility(form: FormModel, visibilityObj: WidgetVisibilityModel): boolean {
        const isLeftFieldPresent = visibilityObj && (visibilityObj.leftType || visibilityObj.leftValue);
        if (!isLeftFieldPresent || isLeftFieldPresent === 'null') {
            return true;
        } else {
            return this.isFieldVisible(form, visibilityObj);
        }
    }

    isFieldVisible(form: FormModel, visibilityObj: WidgetVisibilityModel, accumulator: any[] = [], result: boolean = false): boolean {
        const leftValue = this.getLeftValue(form, visibilityObj);
        const rightValue = this.getRightValue(form, visibilityObj);
        const actualResult = this.evaluateCondition(leftValue, rightValue, visibilityObj.operator);

        accumulator.push({ value: actualResult, operator: visibilityObj.nextConditionOperator });

        if (this.isValidCondition(visibilityObj.nextCondition)) {
            result = this.isFieldVisible(form, visibilityObj.nextCondition, accumulator);
        } else if (accumulator[0] !== undefined) {
            result = Function('"use strict";return (' +
                 accumulator.map((expression) => this.transformToLiteralExpression(expression)).join('') +
                ')')();
        } else {
            result = actualResult;
        }
        return !!result;
    }

    private transformToLiteralExpression(currentExpression: any): string {
        const currentTransformedValue = !!currentExpression.value ? 'true' : 'false';
        return currentTransformedValue.concat(this.transformToLiteralOperator(currentExpression.operator));
    }

    private transformToLiteralOperator(currentOperator): string {
        switch (currentOperator) {
            case 'and':
                return '&&';
            case 'or' :
                return '||';
            case 'and-not':
                return '&& !';
            case 'or-not':
                return '|| !';
            default:
                return '';
        }
    }

    getLeftValue(form: FormModel, visibilityObj: WidgetVisibilityModel): string {
        let leftValue = '';
        if (visibilityObj.leftType && visibilityObj.leftType === WidgetTypeEnum.variable) {
            leftValue = this.getVariableValue(form, visibilityObj.leftValue, this.processVarList);
        } else if (visibilityObj.leftType && visibilityObj.leftType === WidgetTypeEnum.field) {
            leftValue = this.getFormValue(form, visibilityObj.leftValue);
            if (leftValue === undefined || leftValue === '') {
                const variableValue = this.getVariableValue(form, visibilityObj.leftValue, this.processVarList);
                leftValue = !this.isInvalidValue(variableValue) ? variableValue : leftValue;
            }
        }
        return leftValue;
    }

    getRightValue(form: FormModel, visibilityObj: WidgetVisibilityModel): string {
        let valueFound = '';
        if (visibilityObj.rightType === WidgetTypeEnum.variable) {
            valueFound = this.getVariableValue(form, visibilityObj.rightValue, this.processVarList);
        } else if (visibilityObj.rightType === WidgetTypeEnum.field) {
            valueFound = this.getFormValue(form, visibilityObj.rightValue);
        } else {
            if (moment(visibilityObj.rightValue, 'YYYY-MM-DD', true).isValid()) {
                valueFound = visibilityObj.rightValue + 'T00:00:00.000Z';
            } else {
                valueFound = visibilityObj.rightValue;
            }
        }
        return valueFound;
    }

    getFormValue(form: FormModel, fieldId: string): any {
        const formField = this.getFormFieldById(form, fieldId);
        let value = undefined;

        if (this.isFormFieldValid(formField)) {
            value = this.getFieldValue(form.values, fieldId);

            if (this.isInvalidValue(value)) {
                value = this.searchValueInForm(formField, fieldId);
            }
        }
        return value;
    }

    isFormFieldValid(formField: FormFieldModel): boolean {
        return formField && formField.isValid;
    }

    getFieldValue(valueList: any, fieldId: string): any {
        let labelFilterByName, valueFound;
        if (fieldId && fieldId.indexOf('_LABEL') > 0) {
            labelFilterByName = fieldId.substring(0, fieldId.length - 6);
            if (valueList[labelFilterByName]) {
                valueFound = valueList[labelFilterByName].name;
            }
        } else if (valueList[fieldId] && valueList[fieldId].id) {
            valueFound = valueList[fieldId].id;
        } else {
            valueFound = valueList[fieldId];
        }
        return valueFound;
    }

    private isInvalidValue(value: any): boolean {
        return value === undefined || value === null;
    }

    getFormFieldById(form: FormModel, fieldId: string): FormFieldModel {
        return form.getFormFields().find((formField: FormFieldModel) => this.isSearchedField(formField, fieldId));
    }

    searchValueInForm(formField: FormFieldModel, fieldId: string): string {
        let fieldValue = '';

        if (formField) {
            fieldValue = this.getObjectValue(formField, fieldId);

            if (!fieldValue) {
                if (formField.value && formField.value.id) {
                    fieldValue = formField.value.id;
                } else if (!this.isInvalidValue(formField.value)) {
                    fieldValue = formField.value;
                }
            }
        }
        return fieldValue;
    }

    isParentTabVisible(form: FormModel, currentFormField: FormFieldModel | TabModel): boolean {
        const containers = this.getFormTabContainers(form);
        let isVisible: boolean = true;
        containers.map((container: ContainerModel) => {
            if (!!this.getCurrentFieldFromTabById(container, currentFormField.id)) {
                const currentTab = form.tabs.find((tab: TabModel) => tab.id === container.tab);
                if (!!currentTab) {
                    isVisible = currentTab.isVisible;
                }
            }
        });
        return isVisible;
    }

    private getCurrentFieldFromTabById(container: ContainerModel, fieldId: string): FormFieldModel {
        const tabFields: FormFieldModel[][] = Object.keys(container.field.fields).map(key => container.field.fields[key]);
        let currentField: FormFieldModel;

        for (const tabField of tabFields) {
            currentField = tabField.find((tab: FormFieldModel) => tab.id === fieldId);
            if (currentField) {
                return currentField;
            }
        }
        return null;
    }

    private getFormTabContainers(form: FormModel): ContainerModel[] {
        if (!!form) {
            return <ContainerModel[]> form.fields.filter(field => field.type === 'container' && field.tab);
        }
        return [];
    }

    private getObjectValue(field: FormFieldModel, fieldId: string): string {
        let value = '';
        if (field.value && field.value.name) {
            value = field.value.name;
        } else if (field.options) {
            const option = field.options.find((opt) => opt.id === field.value);
            if (option) {
                value = this.getValueFromOption(fieldId, option);
            }
        }
        return value;
    }

    private getValueFromOption(fieldId: string, option): string {
        let optionValue = '';
        if (fieldId && fieldId.indexOf('_LABEL') > 0) {
            optionValue = option.name;
        } else {
            optionValue = option.id;
        }
        return optionValue;
    }

    private isSearchedField(field: FormFieldModel, fieldId: string): boolean {
        const fieldToFind = fieldId?.indexOf('_LABEL') > 0 ? fieldId.replace('_LABEL', '') : fieldId;
        return (field.id && fieldToFind) ? field.id.toUpperCase() === fieldToFind.toUpperCase() : false;
    }

    getVariableValue(form: FormModel, name: string, processVarList: TaskProcessVariableModel[]): string {
        const processVariableValue = this.getProcessVariableValue(name, processVarList);
        const variableDefaultValue = form.getFormVariableValue(name);

        return (processVariableValue === undefined) ? variableDefaultValue : processVariableValue;
    }

    private getProcessVariableValue(name: string, processVarList: TaskProcessVariableModel[]): string {
        if (processVarList) {
            const processVariable = processVarList.find(
                variable =>
                    variable.id === name ||
                    variable.id === `variables.${name}`
            );

            if (processVariable) {
                return processVariable.value;
            }
        }
        return undefined;
    }

    evaluateCondition(leftValue: any, rightValue: any, operator: string): boolean | undefined {
        switch (operator) {
            case '==':
                return leftValue + '' === rightValue + '';
            case '<':
                return leftValue < rightValue;
            case '!=':
                return leftValue + '' !== rightValue + '';
            case '>':
                return leftValue > rightValue;
            case '>=':
                return leftValue >= rightValue;
            case '<=':
                return leftValue <= rightValue;
            case 'empty':
                return leftValue ? leftValue === '' : true;
            case '!empty':
                return leftValue ? leftValue !== '' : false;
            default:
                this.logService.error(`Invalid operator: ${operator}`);
                return undefined;
        }
    }

    cleanProcessVariable() {
        this.processVarList = [];
    }

    getTaskProcessVariable(taskId: string): Observable<TaskProcessVariableModel[]> {
        return from(this.taskFormsApi.getTaskFormVariables(taskId))
            .pipe(
                map((res) => {
                    const jsonRes = this.toJson(res);
                    this.processVarList = <TaskProcessVariableModel[]> jsonRes;
                    return jsonRes;
                }),
                catchError(() => this.handleError())
            );
    }

    toJson(res: any): any {
        return res || {};
    }

    private isValidCondition(condition: WidgetVisibilityModel): boolean {
        return !!(condition && condition.operator);
    }

    private handleError() {
        this.logService.error('Error while performing a call');
        return throwError('Error while performing a call - Server error');
    }
}
