import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'

function App() {
    return (
        <ApiReferenceReact
            configuration={{
                url: '/api/system/openapi.json',
            }}
        />
    )
}

export default function Page() {
    return <App />
}