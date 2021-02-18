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

import { async, TestBed } from '@angular/core/testing';
import { AppConfigService } from '../app-config/app-config.service';
import { AuthGuardBpm } from './auth-guard-bpm.service';
import { AuthenticationService } from './authentication.service';
import { RouterStateSnapshot, Router } from '@angular/router';
import { setupTestBed } from '../testing/setup-test-bed';
import { CoreTestingModule } from '../testing/core.testing.module';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';

describe('AuthGuardService BPM', () => {

    let authGuard: AuthGuardBpm;
    let authService: AuthenticationService;
    let router: Router;
    let appConfigService: AppConfigService;

    setupTestBed({
        imports: [
            TranslateModule.forRoot(),
            CoreTestingModule
        ]
    });

    beforeEach(() => {
        localStorage.clear();
        authService = TestBed.inject(AuthenticationService);
        authGuard = TestBed.inject(AuthGuardBpm);
        router = TestBed.inject(Router);
        appConfigService = TestBed.inject(AppConfigService);

        appConfigService.config.providers = 'BPM';
        appConfigService.config.auth = {};
        appConfigService.config.oauth2 = {};
    });

    it('should redirect url if the alfresco js api is NOT logged in and isOAuth with silentLogin', async(async () => {
        spyOn(router, 'navigateByUrl').and.stub();
        spyOn(authService, 'isBpmLoggedIn').and.returnValue(false);
        spyOn(authService, 'isOauth').and.returnValue(true);
        spyOn(authService, 'isPublicUrl').and.returnValue(false);
        spyOn(authService, 'ssoImplicitLogin').and.stub();

        appConfigService.config.oauth2 = {
            silentLogin: true,
            host: 'http://localhost:6543',
            redirectUri: '/',
            clientId: 'activiti',
            publicUrl: 'settings',
            scope: 'openid',
            provider: 'BPM'
        };

        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: 'abc' };

        expect(await authGuard.canActivate(null, route)).toBeFalsy();
        expect(authService.ssoImplicitLogin).toHaveBeenCalledTimes(1);
    }));

    it('if the alfresco js api is logged in should canActivate be true', async(async () => {
        spyOn(authService, 'isBpmLoggedIn').and.returnValue(true);
        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: 'some-url' };

        expect(await authGuard.canActivate(null, route)).toBeTruthy();
    }));

    it('if the alfresco js api is configured with withCredentials true should canActivate be true', async(async () => {
        spyOn(authService, 'isBpmLoggedIn').and.returnValue(true);
        appConfigService.config.auth.withCredentials = true;

        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: 'some-url' };

        expect(await authGuard.canActivate(null, route)).toBeTruthy();
    }));

    it('if the alfresco js api is NOT logged in should canActivate be false', async(async () => {
        spyOn(authService, 'isBpmLoggedIn').and.returnValue(false);
        spyOn(router, 'navigateByUrl').and.stub();
        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: 'some-url' };

        expect(await authGuard.canActivate(null, route)).toEqual(router.parseUrl('/login?redirectUrl=some-url'));
    }));

    it('if the alfresco js api is NOT logged in should trigger a redirect event', async(async () => {
        appConfigService.config.loginRoute = 'login';

        spyOn(router, 'navigateByUrl');
        spyOn(authService, 'isBpmLoggedIn').and.returnValue(false);
        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: 'some-url' };

        expect(await authGuard.canActivate(null, route)).toEqual(router.parseUrl('/login?redirectUrl=some-url'));
    }));

    it('should redirect url if the alfresco js api is NOT logged in and isOAuthWithoutSilentLogin', async(async () => {
        spyOn(router, 'navigateByUrl').and.stub();
        spyOn(authService, 'isBpmLoggedIn').and.returnValue(false);
        spyOn(authService, 'isOauth').and.returnValue(true);
        appConfigService.config.oauth2.silentLogin = false;
        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: 'some-url' };

        expect(await authGuard.canActivate(null, route)).toEqual(router.parseUrl('/login'));
    }));

    it('should redirect to login url if NOT  you are not logged in and silentLogin is false', async(async () => {
        spyOn(router, 'navigateByUrl').and.stub();
        spyOn(authService, 'isBpmLoggedIn').and.returnValue(false);
        spyOn(authService, 'isOauth').and.returnValue(true);
        appConfigService.config.oauth2.silentLogin = undefined;
        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: 'some-url' };

        expect(await authGuard.canActivate(null, route)).toEqual(router.parseUrl('/login'));
    }));

    it('should set redirect url', async(async () => {
        spyOn(authService, 'setRedirect').and.callThrough();
        spyOn(router, 'navigateByUrl').and.stub();
        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: 'some-url' };

        authGuard.canActivate(null, route);

        expect(authService.setRedirect).toHaveBeenCalledWith({
            provider: 'BPM', url: 'some-url'
        });
        expect(authService.getRedirect()).toEqual('some-url');
    }));

    it('should set redirect navigation commands with query params', async(() => {
        spyOn(authService, 'setRedirect').and.callThrough();
        spyOn(router, 'navigateByUrl').and.stub();
        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: 'some-url;q=123' };

        authGuard.canActivate(null, route);

        expect(authService.setRedirect).toHaveBeenCalledWith({
            provider: 'BPM', url: 'some-url;q=123'
        });
        expect(authService.getRedirect()).toEqual('some-url;q=123');
    }));

    it('should set redirect navigation commands with query params', async(() => {
        spyOn(authService, 'setRedirect').and.callThrough();
        spyOn(router, 'navigateByUrl').and.stub();
        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: '/' };

        authGuard.canActivate(null, route);

        expect(authService.setRedirect).toHaveBeenCalledWith({
            provider: 'BPM', url: '/'
        });
        expect(authService.getRedirect()).toEqual('/');
    }));

    it('should get redirect url from config if there is one configured', async(async () => {
        appConfigService.config.loginRoute = 'fakeLoginRoute';
        spyOn(authService, 'setRedirect').and.callThrough();
        spyOn(router, 'navigateByUrl').and.stub();
        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: 'some-url' };

        expect(await authGuard.canActivate(null, route)).toEqual(router.parseUrl('/fakeLoginRoute?redirectUrl=some-url'));
    }));

    it('should to close the material dialog if is redirect to the login', () => {
        const materialDialog = TestBed.inject(MatDialog);

        spyOn(materialDialog, 'closeAll');

        spyOn(authService, 'setRedirect').and.callThrough();
        spyOn(router, 'navigateByUrl').and.stub();
        const route: RouterStateSnapshot = <RouterStateSnapshot> { url: 'some-url' };

        authGuard.canActivate(null, route);

        expect(authService.setRedirect).toHaveBeenCalledWith({
            provider: 'BPM', url: 'some-url'
        });

        expect(materialDialog.closeAll).toHaveBeenCalled();
    });
});
