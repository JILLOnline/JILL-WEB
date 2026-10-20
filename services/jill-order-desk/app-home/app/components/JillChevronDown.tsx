import "../styles/jill-chevron.css";

export function JillChevronDown({className=""}:{className?:string}){
  return <svg className={"jill-ui__chevron"+(className?" "+className:"")}
    viewBox="0 0 16 16" width="14" height="14" fill="none"
    stroke="currentColor" strokeWidth="2.15" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="m4 6 4 4 4-4"/>
  </svg>;
}
