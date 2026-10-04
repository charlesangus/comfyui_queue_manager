import {EllipsisVertical} from "lucide-react";
import {useContext, useState, useRef, useEffect } from "react";
import {AppContext} from "../internals/app-context";

import InfoOutlineSharpIcon from '@mui/icons-material/InfoOutlineSharp';
import QuizSharpIcon from '@mui/icons-material/QuizSharp';

export default function TopMenu() {
  const [uiState, setUiState] = useState({
    menuOpen: false,
  });

  const {openSplash} = useContext(AppContext)

  const menuRef = useRef(null);
  const toggleRef = useRef(null);

  function toggleMenu() {
    setUiState(prev => ({...prev, menuOpen: !prev.menuOpen}));
  }

  useEffect(() => {
    if (!uiState.menuOpen) return;

    function onPointerDown(e) {
      const menuEl = menuRef.current;
      const toggleEl = toggleRef.current;
      const target = e.target;

      if (!menuEl || !toggleEl) return;
      if (menuEl.contains(target)) return;
      if (toggleEl.contains(target)) return;

      setUiState(prev => ({...prev, menuOpen: false}));
    }

    document.addEventListener("pointerdown", onPointerDown, {capture: true});
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, {capture: true});
    };
  }, [uiState.menuOpen]);

  return (
    <>
      <button
        ref={toggleRef}
        className={'top-menu-toggle' + (uiState.menuOpen ? ' open' : '')} onClick={toggleMenu}>
        <span>
          <EllipsisVertical/>
        </span>
      </button>
      <section
        ref={menuRef}
        className={"top-menu" + (uiState.menuOpen ? ' open' : '')}>
        <div className={"container"}>
          <a className={"button qm-btn qm-btn-text"} href={"https://github.com/QuietNoise/comfyui_queue_manager?tab=readme-ov-file#manual"} target={"_blank"} rel="noreferrer"><QuizSharpIcon /> Documentation</a>
          <button type={"button"}  className={"button qm-btn qm-btn-text"} onClick={() => {toggleMenu(); openSplash()}}><InfoOutlineSharpIcon /> About Queue Manager</button>
        </div>
      </section>
    </>
  );
}
