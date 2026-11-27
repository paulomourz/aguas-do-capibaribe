package br.com.aguas.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.config.RespostasDoc;
import br.com.aguas.dto.TelemetriaDTO;
import br.com.aguas.dto.TelemetriaRequestDTO;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.TelemetriaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/telemetria")
@Tag(name = "Telemetria")
public class TelemetriaController {

    private final TelemetriaService telemetrias;

    public TelemetriaController(TelemetriaService telemetrias) {
        this.telemetrias = telemetrias;
    }

    /**
     * O @Valid faz o Spring checar as anotações do DTO; se algo falhar, o serviço nem é chamado.
     * A leitura fica no nome de quem está autenticado (o sensor, pelo token), nunca de um campo do corpo.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Registrar leitura de telemetria",
            description = "Usado pelo sensor. Vazão nula, negativa ou fora da faixa é recusada com 400. "
                    + "A hora da leitura é a do servidor.")
    @ApiResponse(responseCode = "201", description = "Leitura gravada.")
    @ApiResponse(responseCode = "400", description = "Dados inválidos; `campos` diz o problema de cada um.")
    @RespostasDoc.Validacao
    public TelemetriaDTO registrar(@AuthenticationPrincipal UsuarioAutenticado quem,
                                   @Valid @RequestBody TelemetriaRequestDTO leitura) {
        return telemetrias.registrar(quem, leitura);
    }
}
