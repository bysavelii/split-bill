import "./style.css";
import { mountApp } from "./ui/app";

const root = document.getElementById("app");
if (root === null) throw new Error("Не найден элемент #app");

mountApp(root);
