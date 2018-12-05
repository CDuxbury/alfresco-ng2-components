/*!
 * @license
 * Copyright 2016 Alfresco Software, Ltd.
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

import { StorageService, JwtHelperService } from '@alfresco/adf-core';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TaskFilterCloudModel } from '../models/filter-cloud.model';

@Injectable()
export class TaskFilterCloudService {

    constructor(private storage: StorageService, private jwtService: JwtHelperService) {
    }

    /**
     * Creates and returns the default filters for a process app.
     * @param appName Name of the target app
     * @returns Observable of default filters just created
     */
    public createDefaultFilters(appName: string): Observable<TaskFilterCloudModel[]> {
        let myTasksFilter = this.getMyTasksFilterInstance(appName);
        this.addFilter(myTasksFilter);

        let completedTasksFilter = this.getCompletedTasksFilterInstance(appName);
        this.addFilter(completedTasksFilter);

        return this.getTaskListFilters(appName);
    }

    /**
     * Gets all task filters for a process app.
     * @param appName Name of the target app
     * @returns Observable of task filter details
     */
    getTaskListFilters(appName?: string): Observable<TaskFilterCloudModel[]> {
        const username = this.getUsername();
        let key = `task-filters-${appName}-${username}`;
        const filters = JSON.parse(this.storage.getItem(key) || '[]');
        return new Observable(function(observer) {
            observer.next(filters);
            observer.complete();
        });
    }

    getTaskFilterById(appName: string, id: string): TaskFilterCloudModel {
        const username = this.getUsername();
        let key = `task-filters-${appName}-${username}`;
        let filters = [];
        filters = JSON.parse(this.storage.getItem(key)) || [];
        return filters.filter((filterTmp: TaskFilterCloudModel) => id === filterTmp.id)[0];
    }

    /**
     * Adds a new task filter
     * @param filter The new filter to add
     * @returns Details of task filter just added
     */
    addFilter(filter: TaskFilterCloudModel): Observable<TaskFilterCloudModel> {
        const username = this.getUsername();
        const key = `task-filters-${filter.appName}-${username}`;
        let filters = JSON.parse(this.storage.getItem(key) || '[]');

        filters.push(filter);

        this.storage.setItem(key, JSON.stringify(filters));

        return new Observable(function(observer) {
            observer.next(filter);
            observer.complete();
        });
    }

    /**
     *  Update task filter
     * @param filter The new filter to update
     */
    updateFilter(filter: TaskFilterCloudModel) {
        const username = this.getUsername();
        const key = `task-filters-${filter.appName}-${username}`;
        if (key) {
            let filters = JSON.parse(this.storage.getItem(key) || '[]');
            let itemIndex = filters.findIndex((flt: TaskFilterCloudModel) => flt.id === filter.id);
            filters[itemIndex] = filter;
            this.storage.setItem(key, JSON.stringify(filters));
        }
    }

    /**
     *  Delete task filter
     * @param filter The new filter to delete
     */
    deleteFilter(filter: TaskFilterCloudModel) {
        const username = this.getUsername();
        const key = `task-filters-${filter.appName}-${username}`;
        if (key) {
            let filters = JSON.parse(this.storage.getItem(key) || '[]');
            filters = filters.filter((item) => item.id !== filter.id);
            this.storage.setItem(key, JSON.stringify(filters));
        }
    }

    getUsername(): string {
        return this.getValueFromToken<string>('preferred_username');
    }

    getValueFromToken<T>(key: string): T {
        let value;
        const token = localStorage.getItem('access_token');
        if (token) {
            const tokenPayload = this.jwtService.decodeToken(token);
            value = tokenPayload[key];
        }
        return <T> value;
    }

    /**
     * Creates and returns a filter for "My Tasks" task instances.
     * @param appName Name of the target app
     * @returns The newly created filter
     */
    getMyTasksFilterInstance(appName: string): TaskFilterCloudModel {
        const username = this.getUsername();
        return new TaskFilterCloudModel({
            name: 'ADF_CLOUD_TASK_FILTERS.MY_TASKS',
            key: 'my-tasks',
            icon: 'inbox',
            appName: appName,
            state: 'ASSIGNED',
            assignment: username,
            sort: 'id',
            order: 'ASC'
        });
    }

    /**
     * Creates and returns a filter for "Completed" task instances.
     * @param appName Name of the target app
     * @returns The newly created filter
     */
    getCompletedTasksFilterInstance(appName: string): TaskFilterCloudModel {
        return new TaskFilterCloudModel({
            name: 'ADF_CLOUD_TASK_FILTERS.COMPLETED_TASKS',
            key: 'completed-tasks',
            icon: 'done',
            appName: appName,
            state: 'COMPLETED',
            assignment: '',
            sort: 'id',
            order: 'ASC'
        });
    }
}
