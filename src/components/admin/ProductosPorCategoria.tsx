import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { UtensilsCrossed, ChevronRight, Folder, FolderOpen } from 'lucide-react';

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  imagen_url?: string | null;
  categoria_id: string | null;
  stock?: number | null;
}

interface Categoria {
  id: string;
  nombre: string;
  parent_id: string | null;
  orden: number | null;
}

interface ProductosPorCategoriaProps {
  productos: Producto[];
  categorias: Categoria[];
  cart: { type: 'product'; id: string; cantidad: number }[];
  onAddProduct: (producto: Producto) => void;
}

export default function ProductosPorCategoria({
  productos,
  categorias,
  cart,
  onAddProduct
}: ProductosPorCategoriaProps) {
  // Organize categories into hierarchy
  const { rootCategories, childrenMap, productosByCategoria, uncategorizedProducts } = useMemo(() => {
    // Separate root categories (parent_id = null) from subcategories
    const roots: Categoria[] = [];
    const children: Record<string, Categoria[]> = {};
    
    for (const cat of categorias) {
      if (cat.parent_id === null) {
        roots.push(cat);
      } else {
        if (!children[cat.parent_id]) {
          children[cat.parent_id] = [];
        }
        children[cat.parent_id].push(cat);
      }
    }
    
    // Sort roots by orden
    roots.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    
    // Sort children by orden
    for (const parentId of Object.keys(children)) {
      children[parentId].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    }
    
    // Group products by categoria_id
    const prodsByCategoria: Record<string, Producto[]> = {};
    const uncategorized: Producto[] = [];
    
    for (const prod of productos) {
      if (prod.categoria_id) {
        if (!prodsByCategoria[prod.categoria_id]) {
          prodsByCategoria[prod.categoria_id] = [];
        }
        prodsByCategoria[prod.categoria_id].push(prod);
      } else {
        uncategorized.push(prod);
      }
    }
    
    return {
      rootCategories: roots,
      childrenMap: children,
      productosByCategoria: prodsByCategoria,
      uncategorizedProducts: uncategorized
    };
  }, [categorias, productos]);

  const getCartQuantity = (productId: string): number => {
    const item = cart.find(c => c.type === 'product' && c.id === productId);
    return item ? item.cantidad : 0;
  };

  const renderProductCard = (producto: Producto) => {
    const cantidad = getCartQuantity(producto.id);
    return (
      <button
        key={producto.id}
        onClick={() => onAddProduct(producto)}
        className="relative flex flex-col items-center p-3 border rounded-lg hover:bg-secondary/50 transition-colors text-left"
      >
        {producto.imagen_url ? (
          <img 
            src={producto.imagen_url} 
            alt={producto.nombre}
            className="w-10 h-10 rounded-lg object-cover mb-2"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-2">
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <p className="text-xs font-medium text-center line-clamp-2">{producto.nombre}</p>
        <p className="text-xs text-primary font-bold">S/ {producto.precio.toFixed(2)}</p>
        
        {cantidad > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
            {cantidad}
          </Badge>
        )}
      </button>
    );
  };

  const renderSubcategory = (subcat: Categoria) => {
    const prods = productosByCategoria[subcat.id] || [];
    if (prods.length === 0) return null;
    
    return (
      <div key={subcat.id} className="mb-4">
        <div className="flex items-center gap-2 mb-2 pl-2">
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{subcat.nombre}</span>
          <Badge variant="secondary" className="text-[10px]">{prods.length}</Badge>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pl-5">
          {prods.map(renderProductCard)}
        </div>
      </div>
    );
  };

  const renderRootCategory = (rootCat: Categoria) => {
    const subcats = childrenMap[rootCat.id] || [];
    const directProducts = productosByCategoria[rootCat.id] || [];
    
    // Check if this category has any products (directly or in subcategories)
    const subcatProductCount = subcats.reduce((acc, sub) => 
      acc + (productosByCategoria[sub.id]?.length || 0), 0
    );
    const totalProducts = directProducts.length + subcatProductCount;
    
    if (totalProducts === 0) return null;
    
    return (
      <AccordionItem key={rootCat.id} value={rootCat.id} className="border rounded-lg mb-2">
        <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-secondary/30 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-primary" />
            <span className="font-medium">{rootCat.nombre}</span>
            <Badge variant="outline" className="text-[10px] ml-1">
              {totalProducts} productos
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-2 pb-3">
          {/* Direct products under root category */}
          {directProducts.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
              {directProducts.map(renderProductCard)}
            </div>
          )}
          
          {/* Subcategories */}
          {subcats.map(renderSubcategory)}
        </AccordionContent>
      </AccordionItem>
    );
  };

  // Default open categories
  const defaultOpen = rootCategories.map(c => c.id);

  return (
    <ScrollArea className="h-[280px]">
      <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
        {rootCategories.map(renderRootCategory)}
      </Accordion>
      
      {/* Uncategorized products */}
      {uncategorizedProducts.length > 0 && (
        <div className="mt-4 border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">Sin categoría</span>
            <Badge variant="secondary" className="text-[10px]">{uncategorizedProducts.length}</Badge>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {uncategorizedProducts.map(renderProductCard)}
          </div>
        </div>
      )}
    </ScrollArea>
  );
}
