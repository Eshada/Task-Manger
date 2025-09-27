import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AuthCodeError() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 bg-card/50">
        <CardHeader className="text-center">
          <CardTitle className="text-destructive">Authentication Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            There was an error during the authentication process. Please try signing in again.
          </p>
          <Link href="/">
            <Button className="w-full">Back to Sign In</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
