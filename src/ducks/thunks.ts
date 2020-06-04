import { IThunk } from "./types";
import { IScreen } from "../models/screen";
import RB from "rollbar";

declare let __API_HOST__: string;
declare let Rollbar: RB;

export namespace Thunk {
  export function googleOauthInitialize(): IThunk {
    return async (_, __, env): Promise<void> => {
      if (window.gapi != null) {
        env.googleAuth = (await initializeGapi()).auth;
      } else {
        window.handleGapiLoad = async () => {
          env.googleAuth = (await initializeGapi()).auth;
        };
      }
    };
  }

  export function googleSignIn(): IThunk {
    return async (dispatch, getState, env) => {
      if (env.googleAuth != null) {
        const user = await env.googleAuth.signIn();
        const result = await env.service.googleSignIn(user.getAuthResponse().access_token);
        Rollbar.configure({ payload: { person: { email: result.email } } });
        if (result.email != null) {
          dispatch({ type: "Login", email: result.email });
          dispatch({ type: "SyncStorage", storage: result.storage });
        }
      }
    };
  }

  export function logOut(): IThunk {
    return async (dispatch, getState, env) => {
      await env.service.signout();
      dispatch({ type: "Logout" });
    };
  }

  export function sync(): IThunk {
    return async (dispatch, getState, env) => {
      if (getState().email != null) {
        await env.service.postStorage(getState().storage);
      }
    };
  }

  export function fetchStorage(): IThunk {
    return async (dispatch, getState, env) => {
      const result = await env.service.getStorage();
      if (result.email != null) {
        Rollbar.configure({ payload: { person: { email: result.email } } });
        dispatch({ type: "Login", email: result.email });
        dispatch({ type: "SyncStorage", storage: result.storage });
      }
    };
  }

  function initializeGapi(): Promise<{ auth: gapi.auth2.GoogleAuth }> {
    return new Promise((resolve) => {
      window.gapi.load("auth2", () => {
        const auth2 = window.gapi.auth2.init({
          scope: "openid",
          fetch_basic_profile: false,
          client_id: "944666871420-p8kv124sgte8o0p6ev2ah6npudsl7e4f.apps.googleusercontent.com",
        });

        resolve({ auth: auth2 });
      });
    });
  }

  export function sendTimerPushNotification(sid?: number): IThunk {
    return (dispatch, getState, env) => {
      env.audio.play();
      if (sid != null) {
        env.service.sendTimerPushNotification(sid);
      }
    };
  }

  export function pushScreen(screen: IScreen): IThunk {
    return (dispatch) => {
      dispatch({ type: "PushScreen", screen });
      window.scroll(0, 0);
    };
  }

  export function pullScreen(): IThunk {
    return (dispatch) => {
      dispatch({ type: "PullScreen" });
      window.scroll(0, 0);
    };
  }
}
