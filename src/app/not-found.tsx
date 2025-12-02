import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#000f24] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <CardTitle className="text-white text-2xl">404</CardTitle>
          <CardDescription className="text-white/70">
            ページが見つかりません
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-white/60 text-center">
            お探しのページは存在しないか、移動された可能性があります
          </p>
          
          <div className="space-y-2">
            <Button asChild className="w-full bg-white text-black hover:bg-white/90">
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                ログインページへ戻る
              </Link>
            </Button>
            
            <Button 
              variant="outline" 
              asChild 
              className="w-full border-white/20 text-white/80 hover:bg-white/10"
            >
              <Link href="/memories/create">
                <ArrowLeft className="w-4 h-4 mr-2" />
                想い出ページ作成へ
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
