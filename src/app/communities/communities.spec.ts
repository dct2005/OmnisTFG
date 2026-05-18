import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';

import { CommunitiesComponent } from './communities';
import { CommunityService } from '../services/community.service';
import { AuthService } from '../services/auth';

describe('CommunitiesComponent', () => {
  let component: CommunitiesComponent;
  let fixture: ComponentFixture<CommunitiesComponent>;
  let mockCommunityService: any;
  let mockAuthService: any;

  beforeEach(async () => {
    mockCommunityService = jasmine.createSpyObj('CommunityService', ['getCommunities']);
    mockCommunityService.getCommunities.and.returnValue(of([]));

    mockAuthService = {
      currentUser: signal(null),
      getAuthHeaders: jasmine.createSpy('getAuthHeaders').and.returnValue({ headers: {} })
    };

    await TestBed.configureTestingModule({
      imports: [CommunitiesComponent, RouterTestingModule],
      providers: [
        { provide: CommunityService, useValue: mockCommunityService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(CommunitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
