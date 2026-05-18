import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Auth } from '@angular/fire/auth';

import { AuthService } from './auth';

describe('AuthService', () => {
  let service: AuthService;
  let mockAuth: any;

  beforeEach(() => {
    mockAuth = {};

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Auth, useValue: mockAuth }
      ]
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
