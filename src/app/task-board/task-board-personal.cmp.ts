import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PersonalTaskCmp } from './personal-task/personal-task.cmp';
import { ApplicationListCmp } from './application-list/application-list.cmp';

@Component({
  selector: 'app-task-board-personal',
  imports: [PersonalTaskCmp, ApplicationListCmp, RouterOutlet],
  templateUrl: './task-board-personal.cmp.html',
  styleUrl: './task-board-personal.cmp.css',
})
export class TaskBoardPersonalCmp {}
