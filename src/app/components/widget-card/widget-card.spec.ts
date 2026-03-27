import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetCard } from './widget-card';

describe('WidgetCard', () => {
  let component: WidgetCard;
  let fixture: ComponentFixture<WidgetCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetCard],
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
