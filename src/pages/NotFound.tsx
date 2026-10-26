import { Link } from "react-router-dom";
import { AppBar, Empty } from "../components/ui";

export function NotFound() {
  return (
    <>
      <AppBar title="Not found" back />
      <Empty title="This page doesn't exist">
        <Link className="btn btn-primary" to="/">
          Go home
        </Link>
      </Empty>
    </>
  );
}
