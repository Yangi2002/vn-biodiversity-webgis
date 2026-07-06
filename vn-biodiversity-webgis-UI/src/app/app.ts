import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LoadingScreenComponent } from './shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingScreenComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
