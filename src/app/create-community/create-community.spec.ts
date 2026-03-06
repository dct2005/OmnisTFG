import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateCommunity } from './create-community';

describe('CreateCommunity', () => {
  let component: CreateCommunity;
  let fixture: ComponentFixture<CreateCommunity>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateCommunity]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateCommunity);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
