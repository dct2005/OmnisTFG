import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InformacionCommunities } from './informacion-communities';

describe('InformacionCommunities', () => {
  let component: InformacionCommunities;
  let fixture: ComponentFixture<InformacionCommunities>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InformacionCommunities]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InformacionCommunities);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
