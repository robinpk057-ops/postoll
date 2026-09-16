import { WorkflowProvider } from "./context";


export default function CreateWorkflowLayout(
{
 children
}:{
 children:React.ReactNode;
}
){

  return (

    <WorkflowProvider>

      {children}

    </WorkflowProvider>

  );

}