import _ from 'lodash';
import './css/style.css';
import SpriteSheet from './assets/windows-playing-cards.png';

function component() {
  const element = document.createElement("div");
  element.innerHTML = _.join(["Hello", "webpack"], " ");
  element.classList.add("hello");
  return element;
}

document.body.appendChild(component());
