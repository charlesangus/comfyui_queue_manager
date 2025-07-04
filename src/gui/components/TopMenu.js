import {EllipsisVertical} from "lucide-react";
import {apiCall} from "@/internals/functions";
import {useContext, useState} from "react";
import {AppContext} from "@/internals/app-context";

export default function TopMenu() {
  const [uiState, setUiState] = useState({
    menuOpen: false,
  });

 const {appStatus, setAppStatus} = useContext(AppContext)

  function toggleMenu() {
    setUiState(prev => ({...prev, menuOpen: !prev.menuOpen}));
  }

  async function takeOver() {
    apiCall('queue_manager/takeover?client_id='+appStatus.clientId, null, "GET");
  }

  return (
    <>
      <button className={'top-menu-toggle' + (uiState.menuOpen ? ' open' : '')} onClick={toggleMenu}>
        <span>
          <EllipsisVertical/>
        </span>
      </button>
      <section className={"top-menu" + (uiState.menuOpen ? ' open' : '')}>
        <div className={"container"}>
          <button className={"button"} onClick={takeOver}>🎯 Take over focus</button>
        </div>
      </section>
    </>
  );
}
