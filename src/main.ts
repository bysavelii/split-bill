import "./style.css";
import { mountApp } from "./ui/app";

const root = document.getElementById("app");
if (root === null) throw new Error("Element #app not found");

mountApp(root);
