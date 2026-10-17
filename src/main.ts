import "./page.css";
import { anyGivenMorning } from "./minigames/any-given-morning";

const root = document.getElementById("game");
if (root) anyGivenMorning.mount(root);
